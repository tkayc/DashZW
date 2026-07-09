import React, { useState, useEffect, useRef } from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { base44 } from '@/api';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, CreditCard, Loader2, Tag, CheckCircle2, X, LocateFixed } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCart } from '@/lib/CartContext';
import ScheduledDelivery from '@/components/checkout/ScheduledDelivery';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useDeliveryLocation } from '@/lib/LocationContext';
import { locationApi } from '@/api/location';
import { formatDeliveryLine, deliveryHasCoords } from '@location/utils/deliveryAddress.js';
import { calcDistanceFromShop, getBrowserLocation } from '@/api';
import { calcDeliveryFee, buildPricing, calcServiceFee, getBalance, placeOrder } from '@/api';
import { calcSurgeMultiplier } from '@/api';
import { getCollectionSync, getCollection } from '@/api';
import { validateAdminCoupon, calcAdminPromoDiscount, getProfile, updateProfile } from '@/api';
import { ORDER_STATUS_ON_CREATE, isActiveOrderStatus } from '@/domain/orderStates';

const PAYMENT_METHODS = [
  { id: 'ecocash',          label: 'EcoCash',         icon: '📱' },
  { id: 'onemoney',         label: 'OneMoney',         icon: '💳' },
  { id: 'innbucks',         label: 'InnBucks',         icon: '🏦' },
  { id: 'cash_on_delivery', label: 'Cash on Delivery', icon: '💵' },
];

function calcShopCouponDiscount(promo, subtotal) {
  if (!promo) return 0;
  if (promo.promo_type === 'percentage_discount') return parseFloat((subtotal * promo.discount_value / 100).toFixed(2));
  if (promo.promo_type === 'fixed_discount') return Math.min(promo.discount_value, subtotal);
  return 0;
}

function applySurgeFee(fee, surge) {
  if (!surge?.active || surge.multiplier <= 1) return fee;
  return parseFloat((fee * surge.multiplier).toFixed(2));
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { delivery, selectAddress } = useDeliveryLocation();
  const {
    items, shopId, shopName, clearCart, deliveryMode, deliveryAddress: savedAddress,
    deliveryInstructions, setDeliveryInstructions, driverTip, setDriverTip,
    specialNotes, setSpecialNotes, cartCoupon, cartVoucher,
    setDeliveryMode,
  } = useCart();

  const [profile, setProfile] = useState({});
  const addressTouched = useRef(false);
  const [selectedSavedId, setSelectedSavedId] = useState(delivery?.address_id || null);

  useEffect(() => {
    if (user?.email) getProfile(user.email).then(setProfile).catch(() => setProfile({}));
  }, [user?.email]);

  const initialDeliveryLine = formatDeliveryLine(delivery) || savedAddress || '';
  const [address, setAddress] = useState(initialDeliveryLine);
  const [phone, setPhone] = useState(profile.phone || delivery?.phone_number || '');
  const [scheduledTime, setScheduledTime] = useState(null);
  const [paymentMethod, setPayment] = useState('ecocash');
  const [isSubmitting, setSubmitting] = useState(false);

  const [shop, setShop]             = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [calcingDist, setCalcingDist] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(
    deliveryHasCoords(delivery) ? { lat: delivery.lat, lng: delivery.lng } : null
  );
  const [distError, setDistError]   = useState('');
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [recipientName, setRecipientName] = useState(delivery?.recipient_name || '');
  const [addressMode, setAddressMode] = useState('current');
  const isPickup = deliveryMode === 'pickup';

  // Keep checkout in sync with header / saved delivery location until user edits the field
  useEffect(() => {
    if (isPickup || addressTouched.current) return;

    const line = formatDeliveryLine(delivery) || savedAddress || profile.address || '';
    if (line) setAddress(line);

    if (deliveryHasCoords(delivery)) {
      setGpsCoords({ lat: delivery.lat, lng: delivery.lng });
    }

    if (delivery?.address_id) setSelectedSavedId(delivery.address_id);
    if (delivery?.phone_number && !phone.trim()) setPhone(delivery.phone_number);
    if (delivery?.recipient_name && !recipientName.trim()) setRecipientName(delivery.recipient_name);
    if (delivery?.delivery_instructions && !deliveryInstructions.trim()) {
      setDeliveryInstructions(delivery.delivery_instructions);
    }
  }, [
    delivery,
    savedAddress,
    profile.address,
    isPickup,
    phone,
    recipientName,
    deliveryInstructions,
    setDeliveryInstructions,
  ]);

  useEffect(() => {
    if (profile.phone && !phone.trim()) setPhone(profile.phone);
  }, [profile.phone, phone]);

  useEffect(() => {
    if (!user?.email) return;
    locationApi.listAddresses().then(setSavedAddresses).catch(() => setSavedAddresses([]));
  }, [user?.email]);

  const [walletBalance, setWalletBalance] = useState(0);
  const [pricing, setPricing] = useState(null);
  const [rawDeliveryFee, setRawDeliveryFee] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(null);
  const [feeError, setFeeError] = useState('');
  const [feeRetryNonce, setFeeRetryNonce] = useState(0);
  const [adminPromoResult, setAdminPromoResult] = useState({ discountAmount: 0, freeDelivery: false });
  const [surge, setSurge] = useState({ active: false, multiplier: 1, reason: null });
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [appliedAdminPromo, setAppliedAdminPromo] = useState(null);
  const [couponInput, setCouponInput] = useState(cartCoupon || '');
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState('');

  useEffect(() => {
    calcSurgeMultiplier().then(setSurge).catch(() => setSurge({ active: false, multiplier: 1 }));
  }, []);

  useEffect(() => {
    if (!user?.email) {
      setWalletBalance(0);
      return;
    }
    getBalance(user.email, 'customer').then(setWalletBalance).catch(() => setWalletBalance(0));
  }, [user?.email]);

  // Load shop
  useEffect(() => {
    if (!shopId) return;
    base44.entities.Shop.filter({ id: shopId }).then(r => setShop(r[0]));
  }, [shopId]);

  // Auto-calculate distance whenever address or GPS changes
  useEffect(() => {
    if (isPickup) { setDistanceKm(0); return; }
    if (!shop) return;

    const shopCoords = (shop.lat && shop.lng) ? { lat: shop.lat, lng: shop.lng } : null;
    if (!shopCoords) { setDistError('Shop location not available'); return; }

    const activeCoords = gpsCoords || (deliveryHasCoords(delivery) ? { lat: delivery.lat, lng: delivery.lng } : null);

    // Use stored coordinates when available (GPS or saved address)
    if (activeCoords) {
      locationApi.getMerchantQuote(shopId, activeCoords.lat, activeCoords.lng)
        .then((q) => {
          if (q?.distance_km != null) {
            setDistanceKm(q.distance_km);
            setDistError(q.deliverable === false ? 'Outside merchant delivery radius' : '');
          } else {
            const km = calcDistanceSync(shopCoords, activeCoords);
            setDistanceKm(km);
            setDistError('');
          }
        })
        .catch(() => {
          const km = calcDistanceSync(shopCoords, activeCoords);
          setDistanceKm(km);
        });
      return;
    }

    // Otherwise debounce-geocode the typed address
    const line = address.trim() || formatDeliveryLine(delivery) || savedAddress || '';
    if (!line) { setDistanceKm(null); return; }

    const timer = setTimeout(async () => {
      setCalcingDist(true);
      setDistError('');
      try {
        const km = await calcDistanceFromShop(shopCoords, line);
        if (km === null) {
          setDistError('Address not found — try adding more detail (e.g. suburb, city)');
          setDistanceKm(null);
        } else {
          setDistanceKm(km);
        }
      } catch {
        setDistError('Could not calculate distance. Try a different address.');
        setDistanceKm(null);
      }
      setCalcingDist(false);
    }, 900);

    return () => clearTimeout(timer);
  }, [address, gpsCoords, delivery, savedAddress, shop, shopId, isPickup]);

  // Haversine distance for GPS coords (sync, no require needed)
  function calcDistanceSync(shopCoords, customerCoords) {
    const R = 6371;
    const dLat = (customerCoords.lat - shopCoords.lat) * Math.PI / 180;
    const dLng = (customerCoords.lng - shopCoords.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2
            + Math.cos(shopCoords.lat * Math.PI/180)
            * Math.cos(customerCoords.lat * Math.PI/180)
            * Math.sin(dLng/2)**2;
    return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(2));
  }

  const handleUseMyLocation = async () => {
    setCalcingDist(true);
    setDistError('');
    addressTouched.current = true;
    setAddressMode('current');
    setSelectedSavedId(null);
    const coords = await getBrowserLocation();
    if (!coords) {
      setDistError('Location permission denied. Please type your address instead.');
      setCalcingDist(false);
      return;
    }
    setGpsCoords(coords);
    setAddress('📍 Current location (GPS)');
    setCalcingDist(false);
    toast.success('Location found!');
  };

  const activeOrderCount = getCollectionSync('Order')
    .filter(o => isActiveOrderStatus(o.status)).length;

  const partnerSubtotal = parseFloat(items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2));
  const isFreeDelivery = appliedAdminPromo?.promo_type === 'free_delivery';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFeeError('');
      if (isPickup) {
        try {
          const p = await buildPricing(partnerSubtotal, 0);
          if (!cancelled) {
            setRawDeliveryFee(0);
            setDeliveryFee(0);
            setPricing(p);
          }
        } catch (err) {
          if (!cancelled) setFeeError(err?.message || 'Could not calculate pricing');
        }
        return;
      }
      if (distanceKm == null) {
        if (!cancelled) {
          setRawDeliveryFee(null);
          setDeliveryFee(null);
          setPricing(null);
        }
        return;
      }
      try {
        const baseFee = await calcDeliveryFee(distanceKm, activeOrderCount);
        const raw = applySurgeFee(baseFee, surge);
        const fee = isFreeDelivery ? 0 : raw;
        const p = await buildPricing(partnerSubtotal, fee);
        if (!cancelled) {
          setRawDeliveryFee(raw);
          setDeliveryFee(fee);
          setPricing(p);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[checkout] delivery fee calculation failed:', err);
          setFeeError(err?.message || 'Could not calculate delivery fee — please retry');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [distanceKm, isPickup, partnerSubtotal, activeOrderCount, isFreeDelivery, surge, feeRetryNonce]);

  useEffect(() => {
    if (!pricing) {
      setAdminPromoResult({ discountAmount: 0, freeDelivery: false });
      return;
    }
    calcAdminPromoDiscount(appliedAdminPromo, pricing.customerSubtotal, rawDeliveryFee || 0)
      .then(setAdminPromoResult)
      .catch(() => setAdminPromoResult({ discountAmount: 0, freeDelivery: false }));
  }, [appliedAdminPromo, pricing, rawDeliveryFee]);

  const shopCouponDiscount = calcShopCouponDiscount(appliedPromo, pricing?.customerSubtotal || 0);
  const totalDiscount = parseFloat((shopCouponDiscount + adminPromoResult.discountAmount).toFixed(2));
  const priceAfterCoupons = pricing
    ? Math.max(0, parseFloat((pricing.customerTotal - totalDiscount).toFixed(2)))
    : null;
  const tipAmount = isPickup ? 0 : (driverTip || 0);
  const totalBeforeWallet =
    priceAfterCoupons != null
      ? parseFloat((priceAfterCoupons + tipAmount).toFixed(2))
      : null;
  const walletApplied =
    totalBeforeWallet != null && walletBalance > 0
      ? Math.min(walletBalance, totalBeforeWallet)
      : 0;
  const finalTotal =
    totalBeforeWallet != null
      ? Math.max(0, parseFloat((totalBeforeWallet - walletApplied).toFixed(2)))
      : null;
  const estimatedArrivalMins = distanceKm != null ? Math.round(20 + distanceKm * 3) : null;

  if (!items.length) { navigate('/cart'); return null; }

  const handleApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    const adminResult = await validateAdminCoupon(code, user?.email, partnerSubtotal);
    if (adminResult?.valid) {
      setAppliedAdminPromo(adminResult.promo); setAppliedPromo(null);
      toast.success(adminResult.promo.promo_type === 'free_delivery' ? '🚚 Free delivery applied!' : '🎉 Discount applied!');
      return;
    }
    setCouponChecking(true); setCouponError('');
    try {
      const promos = await base44.entities.Promotion.filter({ shop_id: shopId, is_active: true });
      const match  = promos.find(p => p.coupon_code?.toUpperCase() === code.toUpperCase());
      if (!match) { setCouponError('Coupon not found.'); return; }
      setAppliedPromo(match); setAppliedAdminPromo(null);
      toast.success('Coupon applied!');
    } catch { setCouponError('Could not verify coupon.'); }
    finally { setCouponChecking(false); }
  };

  const handlePlaceOrder = async () => {
    const deliveryLine = address.trim() || formatDeliveryLine(delivery) || savedAddress || '';
    if (shop?.min_order_amount && partnerSubtotal < shop.min_order_amount) {
      toast.error(`Minimum order is ${formatUSD(shop.min_order_amount.toFixed(2))} for ${shopName}`);
      return;
    }
    if (!isPickup && !deliveryLine && !gpsCoords) { toast.error('Please enter your delivery address'); return; }
    if (!phone.trim())  { toast.error('Please enter your phone number'); return; }
    if (!isPickup && distanceKm == null) {
      const waitingOnDistance = gpsCoords || deliveryHasCoords(delivery) || address.trim() || formatDeliveryLine(delivery);
      toast.error(
        waitingOnDistance
          ? (distError || 'Calculating delivery distance — please wait a moment')
          : 'Please enter your delivery address'
      );
      return;
    }
    if (!pricing || totalBeforeWallet == null || !Number.isFinite(totalBeforeWallet)) {
      toast.error('Still calculating totals — please wait');
      return;
    }

    if (user?.email) updateProfile(user.email, { phone, address: gpsCoords ? '' : address }).then(setProfile);

    setSubmitting(true);
    try {
      const serviceOnRaw = await calcServiceFee(rawDeliveryFee || 0);
      const orderItems = items.map(item => ({
        ...item,
        packed_quantity: 0,
        unavailable: false,
        replacement_pending: false,
        replacement_options: [],
      }));

      // Server applies wallet from live balance — never send client wallet_applied as authority
      const result = await placeOrder({
        customer_name:     user?.full_name || '',
        customer_phone:    phone,
        merchant_id:       shopId,
        merchant_name:     shopName,
        merchant_category: shop?.category || '',
        branch_id:         shop?.default_branch_id || null,
        shop_id:           shopId,
        shop_name:         shopName,
        shop_address:      shop?.address || '',
        shop_lat:          shop?.lat,
        shop_lng:          shop?.lng,
        partner_email:     shop?.owner_email || '',
        items: orderItems,
        partner_subtotal:      partnerSubtotal,
        platform_fee:          pricing.platformFee,
        customer_subtotal:     pricing.customerSubtotal,
        delivery_fee:          isPickup ? 0 : pricing.deliveryFee,
        raw_delivery_fee:      rawDeliveryFee ?? 0,
        service_fee:           pricing.serviceFee,
        discount_amount:       totalDiscount,
        admin_discount_amount: adminPromoResult.discountAmount,
        partner_payout:        pricing.partnerPayout,
        platform_earning:      pricing.platformEarning,
        driver_earning: isPickup
          ? 0
          : isFreeDelivery
            ? parseFloat(Math.max(0, (rawDeliveryFee || 0) - serviceOnRaw).toFixed(2))
            : pricing.driverEarning,
        distance_km:       distanceKm,
        delivery_address:  isPickup ? '' : deliveryLine,
        delivery_city:     delivery?.city || 'Johannesburg',
        dest_lat:          gpsCoords?.lat || null,
        dest_lng:          gpsCoords?.lng || null,
        delivery_notes:    [deliveryInstructions, specialNotes, recipientName ? `Recipient: ${recipientName}` : ''].filter(Boolean).join(' | '),
        delivery_instructions: deliveryInstructions,
        special_notes:     specialNotes,
        driver_tip:        tipAmount,
        estimated_arrival_mins: estimatedArrivalMins,
        payment_method:    paymentMethod,
        is_pickup:         isPickup,
        promo_id:          appliedPromo?.id || null,
        promo_title:       appliedPromo?.title || null,
        admin_promo_id:    appliedAdminPromo?.id || null,
        admin_promo_title: appliedAdminPromo?.title || null,
        is_free_delivery:  isFreeDelivery,
        scheduled_time:    scheduledTime || null,
        is_scheduled:      !!scheduledTime,
        pack_progress: {
          packed_units: 0,
          total_units: orderItems.reduce((sum, i) => sum + (i.quantity || 0), 0),
        },
        adjustment_requests: [],
        status: ORDER_STATUS_ON_CREATE,
        total_before_wallet: totalBeforeWallet,
      });

      const order = result.order;
      if (appliedPromo) {
        await base44.entities.Promotion.update(appliedPromo.id, { times_used: (appliedPromo.times_used || 0) + 1 });
      }
      clearCart();
      toast.success(
        result.wallet_applied > 0
          ? `Order placed — wallet applied ${formatUSD(result.wallet_applied.toFixed(2))}`
          : 'Order placed!'
      );
      navigate(`/order/${order.id}/confirmed`);
    } catch (err) {
      console.error(err);
      const msg = err.message || 'Failed to place order. Please try again.';
      toast.error(msg === 'Failed to fetch' ? 'Could not reach server — check that the API is running and try again.' : msg);
    } finally { setSubmitting(false); }
  };

  const readyToOrder = isPickup || (distanceKm != null && !calcingDist);

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-bold text-foreground">Checkout</h1>
      </div>

      {/* Delivery vs Pickup */}
      <div className="flex gap-2 mb-4">
        {['delivery', 'pickup'].map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setDeliveryMode(mode)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
              deliveryMode === mode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-muted-foreground'
            }`}
          >
            {mode === 'delivery' ? 'Delivery' : 'Pickup'}
          </button>
        ))}
      </div>

      {/* Saved addresses (mock) */}
      {!isPickup && savedAddresses.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          {savedAddresses.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                selectAddress(a);
                addressTouched.current = false;
                setSelectedSavedId(a.id);
                setAddressMode('saved');
                setAddress(a.formatted_address || a.street_address || '');
                if (a.lat != null && a.lng != null) setGpsCoords({ lat: a.lat, lng: a.lng });
                if (a.phone_number) setPhone(a.phone_number);
                if (a.recipient_name) setRecipientName(a.recipient_name);
                if (a.delivery_instructions) setDeliveryInstructions(a.delivery_instructions);
              }}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border ${
                selectedSavedId === a.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80'
              }`}
            >
              {a.address_name || a.label || 'Saved'}
            </button>
          ))}
        </div>
      )}

      {isPickup && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <span className="text-2xl">🏪</span>
          <div>
            <p className="font-semibold text-green-800">Pickup — No delivery fee</p>
            <p className="text-xs text-green-700 mt-0.5">Collect your order from {shopName}.</p>
            {shop?.address && <p className="text-xs text-green-600 mt-1">📍 {shop.address}</p>}
          </div>
        </div>
      )}

      {/* Wallet credit notice — applied automatically at checkout */}
      {walletBalance > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-4">
          <span className="text-xl">💙</span>
          <div className="flex-1">
            <p className="font-semibold text-sm text-blue-800">
              Wallet balance: {formatUSD(walletBalance)}
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              Any available credit is applied automatically to this order total.
            </p>
          </div>
        </div>
      )}

      {/* Contact + Address */}
      <div className="bg-card rounded-2xl p-4 border border-border/50 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground">{isPickup ? 'Contact Details' : 'Delivery Details'}</h2>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Phone Number</Label>
            <Input placeholder="+27 7X XXX XXXX" value={phone}
              onChange={e => setPhone(e.target.value)}
              className="mt-1 rounded-xl bg-muted/50 border-0" />
          </div>

          {!isPickup && (
            <div>
              <Label className="text-xs text-muted-foreground">Delivery Address</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Input
                    placeholder="e.g. 123 Rivonia Rd, Sandton"
                    value={address}
                    onChange={e => {
                      addressTouched.current = true;
                      setAddressMode('new');
                      setSelectedSavedId(null);
                      setAddress(e.target.value);
                      setGpsCoords(null);
                      setDistanceKm(null);
                      setDistError('');
                    }}
                    className="rounded-xl bg-muted/50 border-0 pr-8"
                  />
                  {calcingDist && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUseMyLocation}
                  disabled={calcingDist}
                  className="rounded-xl px-3 shrink-0"
                  title="Use my current location">
                  <LocateFixed className="w-4 h-4" />
                </Button>
              </div>

              {/* Status line */}
              {distanceKm != null && !calcingDist && (
                  <div className="mt-1.5">
                    <p className="text-xs text-primary font-medium">
                      ✅ {distanceKm.toFixed(1)} km from {shopName}
                  {rawDeliveryFee != null && <span className="ml-1">— delivery {formatUSD(rawDeliveryFee)}</span>}
                    </p>
                    {surge?.active && (
                      <p className="text-xs text-orange-600 font-medium mt-0.5">
                        🔴 Surge {surge.multiplier.toFixed(1)}× active — {surge.reason}
                      </p>
                    )}
                  </div>
              )}
              {calcingDist && (
                <p className="text-xs text-muted-foreground mt-1.5">🔍 Finding your address…</p>
              )}
              {distError && !calcingDist && (
                <p className="text-xs text-orange-600 mt-1.5">{distError}</p>
              )}
              {!address.trim() && !formatDeliveryLine(delivery) && !calcingDist && !distanceKm && (
                <p className="text-xs text-amber-700 mt-1.5">
                  Type your address or tap 📍 to use your current location
                </p>
              )}
              {!addressTouched.current && formatDeliveryLine(delivery) && (
                <p className="text-xs text-green-700 mt-1.5">
                  Using your delivery address from the header
                </p>
              )}
            </div>
          )}

          {!isPickup && (
            <div>
              <Label className="text-xs text-muted-foreground">Delivery instructions</Label>
              <Textarea
                placeholder="Gate code, leave at door, call on arrival…"
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                className="mt-1 rounded-xl bg-muted/50 border-0 h-16"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Manage saved addresses in Profile → Addresses.
              </p>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Special notes</Label>
            <Textarea
              placeholder="Allergies, substitutions…"
              value={specialNotes}
              onChange={(e) => setSpecialNotes(e.target.value)}
              className="mt-1 rounded-xl bg-muted/50 border-0 h-14"
            />
          </div>
        </div>
      </div>

      {/* Scheduled Delivery placeholder */}
      <div className="mb-1">
        <ScheduledDelivery value={scheduledTime} onChange={setScheduledTime} />
        <p className="text-[10px] text-muted-foreground px-1 mb-3">
          Scheduled delivery is a placeholder — slots are not yet enforced by merchants.
        </p>
      </div>

      {/* Review order */}
      <div className="bg-card rounded-2xl p-4 border border-border/50 mb-4">
        <h2 className="font-semibold text-foreground mb-3">Review order</h2>
        <p className="text-xs text-muted-foreground mb-2">{shopName}</p>
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item._key || item.menu_item_id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.quantity}× {item.name}
                {item.variant_name ? ` (${item.variant_name})` : ''}
              </span>
              <span className="font-medium">{formatUSD((item.price * item.quantity))}</span>
            </div>
          ))}
        </div>
        {estimatedArrivalMins != null && !isPickup && (
          <p className="text-xs text-primary font-medium mt-3">
            Estimated arrival ~{estimatedArrivalMins} min
          </p>
        )}
      </div>

      {/* Driver tip */}
      {!isPickup && (
        <div className="bg-card rounded-2xl p-4 border border-border/50 mb-4">
          <h2 className="font-semibold text-foreground mb-2">Driver tip</h2>
          <p className="text-xs text-muted-foreground mb-3">Optional — 100% goes to your driver</p>
          <div className="flex flex-wrap gap-2">
            {[0, 5, 10, 15, 20].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDriverTip(t)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  driverTip === t
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 border-transparent text-foreground'
                }`}
              >
                {t === 0 ? 'No tip' : `${formatUSD(t)}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voucher */}
      <div className="bg-card rounded-2xl p-4 border border-border/50 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground">Voucher / Promo Code</h2>
        </div>
        {(appliedPromo || appliedAdminPromo) ? (
          <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${
            appliedAdminPromo ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${appliedAdminPromo ? 'text-blue-600' : 'text-green-600'}`} />
              <div>
                <p className={`text-sm font-semibold ${appliedAdminPromo ? 'text-blue-800' : 'text-green-800'}`}>
                  {appliedAdminPromo ? appliedAdminPromo.title : appliedPromo.title}
                </p>
                {isFreeDelivery && <p className="text-xs text-blue-700">🚚 Free delivery</p>}
                {adminPromoResult.discountAmount > 0 && <p className="text-xs text-blue-700">−{formatUSD(adminPromoResult.discountAmount)} off</p>}
                {shopCouponDiscount > 0 && <p className="text-xs text-green-700">−{formatUSD(shopCouponDiscount)} off</p>}
              </div>
            </div>
            <button onClick={() => { setAppliedPromo(null); setAppliedAdminPromo(null); setCouponInput(''); }}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <Input placeholder="Enter coupon code"
                value={couponInput}
                onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                className="rounded-xl bg-muted/50 border-0 font-mono flex-1" />
              <Button onClick={handleApplyCoupon} disabled={couponChecking || !couponInput.trim()} className="rounded-xl shrink-0">
                {couponChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </Button>
            </div>
            {couponError && <p className="text-xs text-destructive">{couponError}</p>}
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="bg-card rounded-2xl p-4 border border-border/50 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground">Payment Method</h2>
        </div>
        <RadioGroup value={paymentMethod} onValueChange={setPayment} className="space-y-2">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m.id}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                paymentMethod === m.id
                  ? 'bg-primary/10 border border-primary/30'
                  : 'bg-muted/50 border border-transparent hover:bg-muted'
              }`}
            >
              <RadioGroupItem value={m.id} />
              <span className="text-lg">{m.icon}</span>
              <span className="font-medium text-sm">{m.label}</span>
            </label>
          ))}
        </RadioGroup>
        <p className="text-[10px] text-muted-foreground mt-2">
          Saved cards / EcoCash tokens will appear here after payment provider integration.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-2xl p-4 border border-border/50 mb-4">
        <h2 className="font-semibold text-foreground mb-3">Order from {shopName}</h2>
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.menu_item_id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.quantity}× {item.name}</span>
              <span className="font-medium">{formatUSD(item.price * item.quantity)}</span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Items subtotal</span>
            <span>{formatUSD(partnerSubtotal)}</span>
          </div>
          {pricing ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform fee (5%)</span>
                <span>{formatUSD(pricing.platformFee)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {isPickup ? 'Pickup' : distanceKm ? `Delivery (${distanceKm.toFixed(1)} km)` : 'Delivery'}
                  {isFreeDelivery && !isPickup && <span className="text-blue-600 font-medium"> — Free</span>}
                </span>
                <span className={isPickup || isFreeDelivery ? 'text-green-600 font-medium' : ''}>
                  {isPickup ? 'FREE' : rawDeliveryFee != null ? formatUSD(rawDeliveryFee.toFixed(2)) : '—'}
                </span>
              </div>
              {pricing.serviceFee > 0 && !isPickup && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Service fee (included in delivery)</span>
                  <span>{formatUSD(pricing.serviceFee)}</span>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>Coupon discount</span><span>−{formatUSD(totalDiscount)}</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Driver tip</span>
                  <span>{formatUSD(tipAmount)}</span>
                </div>
              )}
              {walletApplied > 0 && (
                <div className="flex justify-between text-sm text-blue-600 font-medium">
                  <span>Wallet credit</span>
                  <span>−{formatUSD(walletApplied)}</span>
                </div>
              )}
              {estimatedArrivalMins != null && !isPickup && (
                <p className="text-xs text-primary font-medium pt-1">
                  Estimated arrival ~{estimatedArrivalMins} min
                  {scheduledTime && ' (after scheduled time)'}
                </p>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>You pay now</span><span>{formatUSD(finalTotal)}</span>
              </div>
              {walletApplied > 0 && (
                <p className="text-xs text-blue-600 text-right -mt-1">
                  {formatUSD(walletApplied)} from your wallet · {formatUSD(Math.max(0, walletBalance - walletApplied))} remaining
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              {calcingDist
                ? 'Calculating distance…'
                : feeError
                  ? (
                    <span className="text-red-600">
                      {feeError}{' '}
                      <button
                        type="button"
                        className="underline font-semibold"
                        onClick={() => setFeeRetryNonce((n) => n + 1)}
                      >
                        Retry
                      </button>
                    </span>
                  )
                  : (formatDeliveryLine(delivery) || gpsCoords || address.trim())
                    ? 'Calculating delivery fee…'
                    : 'Enter your address above'}
            </p>
          )}
        </div>
      </div>

      <Button onClick={handlePlaceOrder}
        disabled={isSubmitting || !readyToOrder || !pricing}
        className="w-full h-12 rounded-2xl font-semibold text-base">
        {isSubmitting
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Placing Order…</>
          : calcingDist
            ? 'Finding your location…'
            : feeError
              ? 'Fix delivery fee error above'
            : !readyToOrder && (formatDeliveryLine(delivery) || gpsCoords || address.trim())
              ? 'Calculating delivery fee…'
            : finalTotal != null
              ? `Place Order — ${formatUSD(finalTotal.toFixed(2))}`
              : 'Enter address to continue'
        }
      </Button>
    </div>
  );
}

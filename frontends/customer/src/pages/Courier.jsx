import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDown,
  MapPin,
  Package,
  Loader2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  LocateFixed,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { locationApi } from '@/api/location';
import { placeCourierOrder } from '@/api';
import { formatUSD } from '@/lib/formatCurrency';
import { useAuth } from '@/lib/AuthContext';
import { COURIER_VEHICLES } from '@/domain/courierVehicles';

const PAYMENT_METHODS = [
  { id: 'ecocash', label: 'EcoCash', icon: '📱' },
  { id: 'onemoney', label: 'OneMoney', icon: '💳' },
  { id: 'innbucks', label: 'InnBucks', icon: '🏦' },
  { id: 'cash_on_delivery', label: 'Cash on delivery', icon: '💵' },
];

/** Demo spots near seeded drivers — works offline without Nominatim. */
const DEMO_LOCATIONS = [
  { id: 'sandton', label: 'Sandton City', address: 'Rivonia Road, Sandton, Johannesburg', lat: -26.1073, lng: 28.0570 },
  { id: 'rosebank', label: 'Rosebank Mall', address: 'Oxford Road, Rosebank, Johannesburg', lat: -26.1465, lng: 28.0427 },
  { id: 'braam', label: 'Braamfontein', address: 'Juta Street, Braamfontein, Johannesburg', lat: -26.1950, lng: 28.0410 },
  { id: 'melville', label: 'Melville', address: '7th Street, Melville, Johannesburg', lat: -26.1820, lng: 27.9980 },
  { id: 'parktown', label: 'Parktown', address: 'Jan Smuts Avenue, Parktown, Johannesburg', lat: -26.1825, lng: 28.0330 },
];

function findDemoLocation(address) {
  const key = String(address || '').trim().toLowerCase();
  if (!key) return null;
  return DEMO_LOCATIONS.find(
    (loc) =>
      loc.address.toLowerCase() === key ||
      loc.label.toLowerCase() === key ||
      key.includes(loc.label.toLowerCase()) ||
      loc.address.toLowerCase().includes(key)
  ) || null;
}

async function resolveAddress(address) {
  const trimmed = address?.trim();
  if (!trimmed) return null;

  const demo = findDemoLocation(trimmed);
  if (demo) {
    return { address: demo.address, lat: demo.lat, lng: demo.lng };
  }

  try {
    const result = await locationApi.geocode(trimmed, { city: 'Johannesburg', country: 'South Africa' });
    if (result?.lat == null || result?.lng == null) return null;
    return {
      address: trimmed,
      lat: result.lat,
      lng: result.lng,
    };
  } catch {
    return null;
  }
}

export default function Courier() {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();

  const [pickupAddress, setPickupAddress] = useState(DEMO_LOCATIONS[0].address);
  const [dropoffAddress, setDropoffAddress] = useState(DEMO_LOCATIONS[2].address);
  const [pickupNotes, setPickupNotes] = useState('');
  const [dropoffNotes, setDropoffNotes] = useState('');
  const [packageDescription, setPackageDescription] = useState('Sealed documents');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('motorbike');
  const [paymentMethod, setPaymentMethod] = useState('ecocash');
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(null);

  const selectedOption = useMemo(
    () => quote?.vehicle_options?.find((v) => v.id === vehicleType) || quote?.selected || null,
    [quote, vehicleType]
  );

  const canQuote = pickupAddress.trim().length > 3 && dropoffAddress.trim().length > 3;

  useEffect(() => {
    if (!canQuote) {
      setQuote(null);
      setQuoteError('');
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingQuote(true);
      setQuoteError('');
      try {
        const pickup = await resolveAddress(pickupAddress);
        const dropoff = await resolveAddress(dropoffAddress);
        if (cancelled) return;
        if (!pickup || !dropoff) {
          setQuote(null);
          setQuoteError('Could not find those addresses. Tap a demo location below.');
          return;
        }
        const result = await locationApi.quoteCourier({
          pickup,
          dropoff,
          vehicle_type: vehicleType,
        });
        if (cancelled) return;
        setQuote(result);
      } catch (err) {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(err.message || 'Could not calculate courier price');
      } finally {
        if (!cancelled) setLoadingQuote(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pickupAddress, dropoffAddress, vehicleType, canQuote]);

  const handleBook = async () => {
    if (isGuest) {
      toast.message('Sign in to book a courier');
      navigate('/login');
      return;
    }
    if (!selectedOption?.available) {
      toast.error(selectedOption?.unavailable_reason || 'Selected vehicle is not available');
      return;
    }
    if (!packageDescription.trim()) {
      toast.error('Describe what you are sending');
      return;
    }

    setBooking(true);
    try {
      const pickup = await resolveAddress(pickupAddress);
      const dropoff = await resolveAddress(dropoffAddress);
      if (!pickup || !dropoff) {
        toast.error('Could not verify addresses — pick a demo location');
        return;
      }

      const result = await placeCourierOrder({
        pickup: { ...pickup, notes: pickupNotes },
        dropoff: { ...dropoff, notes: dropoffNotes },
        vehicle_type: vehicleType,
        package_description: packageDescription,
        recipient_phone: recipientPhone,
        pickup_notes: pickupNotes,
        dropoff_notes: dropoffNotes,
        payment_method: paymentMethod,
      });

      setBooked({
        orderId: result.order?.id,
        deliveryCode: result.delivery_code || result.order?.delivery_code,
        total: result.total,
        vehicle: selectedOption.label,
      });
      toast.success('Courier booked!');
    } catch (err) {
      toast.error(err.message || 'Could not book courier');
    } finally {
      setBooking(false);
    }
  };

  const useMyLocation = async (target) => {
    if (!navigator.geolocation) {
      toast.error('Location not supported on this device');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const rev = await locationApi.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          const line =
            rev?.formatted_address ||
            rev?.address ||
            `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
          if (target === 'pickup') setPickupAddress(line);
          else setDropoffAddress(line);
        } catch {
          // Fall back to nearest demo spot if reverse geocode fails
          const nearest = DEMO_LOCATIONS[0];
          if (target === 'pickup') setPickupAddress(nearest.address);
          else setDropoffAddress(nearest.address);
          toast.message('Using a nearby demo location');
        }
      },
      () => toast.error('Location permission denied')
    );
  };

  if (booked) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-700" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Courier booked</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          A {booked.vehicle.toLowerCase()} courier will collect your package soon.
        </p>
        <div className="mt-6 w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
            <KeyRound className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Delivery code</span>
          </div>
          <p className="text-4xl font-black tracking-[0.35em] text-foreground">{booked.deliveryCode}</p>
          <p className="text-xs text-muted-foreground mt-3">
            Share this code with the recipient. The driver will ask for it on delivery.
          </p>
          <p className="text-sm font-semibold text-green-700 mt-4">Total {formatUSD(booked.total)}</p>
        </div>
        <div className="flex gap-2 mt-6 w-full max-w-sm">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setBooked(null)}>
            Book another
          </Button>
          <Button className="flex-1 rounded-xl" onClick={() => navigate(`/order/${booked.orderId}`)}>
            Track delivery
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Courier</h1>
          <p className="text-xs text-muted-foreground">Send packages across town</p>
        </div>
      </div>

      <div className="px-4">
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-5 text-primary-foreground shadow-lg mb-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">Door-to-door courier</p>
              <p className="text-sm text-primary-foreground/80 mt-1">
                Pick a vehicle, we match you with a nearby driver and calculate the price instantly.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Quick demo locations</p>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {DEMO_LOCATIONS.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  if (!pickupAddress || pickupAddress === dropoffAddress) {
                    setPickupAddress(loc.address);
                  } else if (pickupAddress === loc.address) {
                    setDropoffAddress(DEMO_LOCATIONS.find((l) => l.id !== loc.id)?.address || loc.address);
                  } else {
                    setDropoffAddress(loc.address);
                  }
                }}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border border-border bg-card hover:bg-muted transition-colors"
              >
                {loc.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Tip: first tap sets pickup, next tap sets drop-off. Motorbike is near Sandton, car near Rosebank, van near Braamfontein.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-0 shadow-sm">
          <div className="flex gap-3">
            <div className="flex flex-col items-center pt-3">
              <span className="w-3 h-3 rounded-full bg-green-500 ring-4 ring-green-500/20" />
              <span className="w-0.5 flex-1 bg-border my-1 min-h-[36px]" />
              <span className="w-3 h-3 rounded-full bg-primary ring-4 ring-primary/20" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Pickup</label>
                  <div className="flex gap-1">
                    {DEMO_LOCATIONS.slice(0, 3).map((loc) => (
                      <button
                        key={`p-${loc.id}`}
                        type="button"
                        onClick={() => setPickupAddress(loc.address)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          pickupAddress === loc.address
                            ? 'bg-green-100 border-green-300 text-green-800'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {loc.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Street, building, suburb"
                  className="rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => useMyLocation('pickup')}
                  className="mt-1.5 text-xs font-medium text-primary inline-flex items-center gap-1"
                >
                  <LocateFixed className="w-3.5 h-3.5" /> Use current location
                </button>
              </div>
              <div className="flex justify-center -my-1">
                <ArrowDown className="w-4 h-4 text-muted-foreground/50" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Drop-off</label>
                  <div className="flex gap-1">
                    {DEMO_LOCATIONS.slice(2, 5).map((loc) => (
                      <button
                        key={`d-${loc.id}`}
                        type="button"
                        onClick={() => setDropoffAddress(loc.address)}
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          dropoffAddress === loc.address
                            ? 'bg-primary/10 border-primary/40 text-primary'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        {loc.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  value={dropoffAddress}
                  onChange={(e) => setDropoffAddress(e.target.value)}
                  placeholder="Recipient address"
                  className="rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => useMyLocation('dropoff')}
                  className="mt-1.5 text-xs font-medium text-primary inline-flex items-center gap-1"
                >
                  <LocateFixed className="w-3.5 h-3.5" /> Use current location
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Choose vehicle</h2>
          <div className="grid grid-cols-3 gap-2">
            {COURIER_VEHICLES.map((vehicle) => {
              const option = quote?.vehicle_options?.find((v) => v.id === vehicle.id);
              const available = option ? option.available : null;
              const selected = vehicleType === vehicle.id;
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setVehicleType(vehicle.id)}
                  className={`rounded-2xl border p-3 flex flex-col items-center text-center transition-all ${
                    selected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
                      : 'border-border bg-card hover:bg-muted/40'
                  } ${available === false ? 'opacity-60' : ''}`}
                >
                  <img
                    src={vehicle.iconSrc}
                    alt=""
                    className="w-16 h-16 object-contain"
                  />
                  <p className="text-xs font-bold text-foreground mt-2">{vehicle.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                    {vehicle.description}
                  </p>
                  {available === false && (
                    <p className="text-[10px] font-semibold text-orange-600 mt-1">Unavailable</p>
                  )}
                </button>
              );
            })}
          </div>
          {selectedOption && !selectedOption.available && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 border border-orange-200 p-3 text-orange-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs">
                {selectedOption.unavailable_reason ||
                  `No ${selectedOption.label.toLowerCase()} couriers are available near the pickup point.`}
              </p>
            </div>
          )}
          {quoteError && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs">{quoteError}</p>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">What are you sending?</label>
            <Textarea
              value={packageDescription}
              onChange={(e) => setPackageDescription(e.target.value)}
              placeholder="e.g. Sealed documents, shoebox, fragile electronics..."
              className="rounded-xl min-h-[80px]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Recipient phone (optional)</label>
            <Input
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="+27 ..."
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={pickupNotes}
              onChange={(e) => setPickupNotes(e.target.value)}
              placeholder="Pickup notes"
              className="rounded-xl"
            />
            <Input
              value={dropoffNotes}
              onChange={(e) => setDropoffNotes(e.target.value)}
              placeholder="Drop-off notes"
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="mt-5">
          <h2 className="text-sm font-bold text-foreground mb-3">Payment</h2>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethod(method.id)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  paymentMethod === method.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-foreground'
                }`}
              >
                <span className="mr-1.5">{method.icon}</span>
                {method.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Trip summary</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {quote?.distance_km != null
                  ? `${quote.distance_km.toFixed(1)} km`
                  : loadingQuote
                    ? 'Calculating…'
                    : 'Pick pickup & drop-off'}
              </p>
            </div>
            {loadingQuote ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-xl font-black text-foreground">
                {selectedOption?.delivery_fee != null ? formatUSD(selectedOption.delivery_fee) : '—'}
              </p>
            )}
          </div>
          {selectedOption?.available && (
            <p className="text-xs text-muted-foreground mt-2">
              ETA ~{selectedOption.estimated_delivery_mins} min · nearest driver{' '}
              {selectedOption.nearest_driver_km != null
                ? `${selectedOption.nearest_driver_km.toFixed(1)} km away`
                : 'nearby'}
            </p>
          )}
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <Button
            className="w-full h-12 rounded-2xl text-base font-bold shadow-lg"
            disabled={booking || loadingQuote || !selectedOption?.available || !canQuote}
            onClick={handleBook}
          >
            {booking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Booking courier...
              </>
            ) : (
              `Book courier · ${selectedOption?.delivery_fee != null ? formatUSD(selectedOption.delivery_fee) : '—'}`
            )}
          </Button>
          {isGuest && (
            <p className="text-center text-[11px] text-muted-foreground mt-2">
              <Link to="/login" className="text-primary font-semibold">
                Sign in
              </Link>{' '}
              to book
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

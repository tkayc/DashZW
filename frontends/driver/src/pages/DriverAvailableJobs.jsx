import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { MapPin, Clock, DollarSign, Store, Bike, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { formatUSD } from '@/lib/formatCurrency';
import { isDriverBlocked, canDriverAcceptOrder, calcServiceFee, useBalance, canAcceptCodOrder } from '@/api';
import {
  ORDER_STATUS,
  ORDER_STATUS_ON_DRIVER_ACCEPT,
  normalizeOrderStatus,
  isTerminalOrderStatus,
} from '@/domain/orderStates';
import { useOrderAlertSound } from '@/hooks/useOrderAlertSound';
import { haversineKm } from '@/api';
import { canDriverFulfillVehicle, normalizeCourierVehicle } from '@/domain/courierVehicles';
import { assertDriverCanAcceptJobs } from '@/api/domain/driverOnboarding';

const PAYMENT_LABELS = {
  ecocash: 'EcoCash', onemoney: 'OneMoney', innbucks: 'InnBucks', cash_on_delivery: 'Cash on Delivery',
};


/**
 * Multi-order rules:
 *  1. Driver can hold max 2 active orders at once.
 *  2. If driver already has an order picked up >10 min ago, must deliver that first.
 *  3. If driver already has 1 active order, the new order's shop must be ≤1km from
 *     the existing order's shop, AND delivery destination must be ≤2km from
 *     existing order's delivery destination.
 *  4. COD wallet check still applies.
 */
function checkMultiOrderEligibility(newOrder, activeDriverOrders) {
  const active = activeDriverOrders.filter(o => !isTerminalOrderStatus(o.status));

  if (active.length === 0) return { ok: true };
  if (active.length >= 2) return { ok: false, reason: 'You already have 2 active orders. Deliver one first.' };

  const existing = active[0];
  const tenMinAgo = Date.now() - 10 * 60 * 1000;
  const pickedAt  = new Date(existing.updated_date).getTime();

  if (pickedAt < tenMinAgo) {
    return { ok: false, reason: 'You picked up an order over 10 minutes ago — deliver it before accepting another.' };
  }

  // Check shop proximity (both shops must be ≤1km apart)
  // We use lat/lng stored on orders if available, otherwise skip (geocoding is async)
  // Since we stored shop coords as part of order, use delivery coords as proxy for shop
  // Best effort: compare shop addresses via stored coords
  const existingShopCoords = existing.shop_lat != null
    ? { lat: existing.shop_lat, lng: existing.shop_lng }
    : null;
  const newShopCoords = newOrder.shop_lat != null
    ? { lat: newOrder.shop_lat, lng: newOrder.shop_lng }
    : null;

  if (existingShopCoords && newShopCoords) {
    const shopDist = haversineKm(existingShopCoords.lat, existingShopCoords.lng, newShopCoords.lat, newShopCoords.lng);
    if (shopDist > 1) {
      return { ok: false, reason: `Shops are ${shopDist.toFixed(1)}km apart. They must be within 1km for a combined delivery.` };
    }
  }

  // Check delivery destination proximity (must be ≤2km apart)
  const existingDestCoords = existing.dest_lat != null
    ? { lat: existing.dest_lat, lng: existing.dest_lng }
    : null;
  const newDestCoords = newOrder.dest_lat != null
    ? { lat: newOrder.dest_lat, lng: newOrder.dest_lng }
    : null;

  if (existingDestCoords && newDestCoords) {
    const destDist = haversineKm(existingDestCoords.lat, existingDestCoords.lng, newDestCoords.lat, newDestCoords.lng);
    if (destDist > 2) {
      return { ok: false, reason: `Delivery destinations are ${destDist.toFixed(1)}km apart. They must be within 2km for a combined delivery.` };
    }
  }

  return { ok: true, combined: true };
}

export default function DriverAvailableJobs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [accepting, setAccepting] = useState(null);
  const [rejectedIds, setRejectedIds] = useState(() => new Set());

  const { data: available = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['driver-available'],
    queryFn: () => base44.entities.Order.filter({ status: ORDER_STATUS.READY_FOR_PICKUP }, '-created_date', 50),
    refetchInterval: 3000,
  });

  const { data: myOrders = [] } = useQuery({
    queryKey: ['driver-active', user?.email],
    queryFn: () => base44.entities.Order.filter({ driver_email: user.email }, '-created_date', 20),
    enabled: !!user?.email,
    refetchInterval: 5000,
  });

  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile', user?.email],
    queryFn: async () => {
      const rows = await base44.entities.DriverProfile.filter({ email: user.email });
      return rows[0] || null;
    },
    enabled: !!user?.email,
  });

  const driverVehicle = normalizeCourierVehicle(driverProfile?.vehicle_type) || 'motorbike';
  const meta = driverProfile?.metadata || {};
  const verificationStatus = meta.verification_status || driverProfile?.verification_status || 'approved';
  const quizPassed = meta.quiz_passed ?? driverProfile?.quiz_passed ?? true;
  const accountActive = verificationStatus === 'approved' && quizPassed;

  const unassigned = available.filter((o) => {
    if (o.driver_email || o.is_pickup || rejectedIds.has(o.id)) return false;
    if (!accountActive) return false;
    const isCourier =
      o.order_kind === 'courier' ||
      o.merchant_category === 'courier' ||
      String(o.special_notes || '').startsWith('COURIER|');
    const requiredVehicle =
      o.required_vehicle_type ||
      o.pack_progress?.courier_meta?.required_vehicle_type ||
      (String(o.special_notes || '').startsWith('COURIER|')
        ? String(o.special_notes).split('|')[1]
        : null);
    if (isCourier && requiredVehicle) {
      return canDriverFulfillVehicle(driverVehicle, requiredVehicle);
    }
    return true;
  });
  const [blocked, setBlocked] = useState(false);
  const balance = useBalance(user?.email, 'driver');
  const activeOrders = myOrders.filter(o => !isTerminalOrderStatus(o.status));

  useEffect(() => {
    if (!user?.email) {
      setBlocked(false);
      return;
    }
    isDriverBlocked(user.email).then(setBlocked).catch(() => setBlocked(false));
  }, [user?.email]);

  // Alert sound — rings when jobs are available and driver has capacity
  const { playing: alertPlaying, silence: silenceAlert } = useOrderAlertSound(
    unassigned.length > 0 && activeOrders.length < 2 && !blocked
  );

  const acceptJob = async (order) => {
    // Hard block check
    if (blocked) {
      toast.error('Account blocked — top up your wallet at a partner shop.');
      return;
    }
    try {
      await assertDriverCanAcceptJobs();
    } catch (e) {
      toast.error(e.message || 'Complete onboarding before accepting jobs');
      return;
    }
    // COD wallet check
    const codCheck = await canAcceptCodOrder(user?.email, order).catch(() => null);
    if (codCheck && !codCheck.ok) {
      toast.error(codCheck.reason || 'Insufficient driver float for this COD order.');
      return;
    }
    const canAccept = await canDriverAcceptOrder(user?.email, order);
    if (!canAccept) {
      const _serviceFee = await calcServiceFee(order.delivery_fee || 0);
      const debt = parseFloat(((order.customer_subtotal || 0) + _serviceFee).toFixed(2));
      toast.error(`Wallet too low. This COD order would add ${formatUSD(debt)} debt (limit -$5). Top up first.`);
      return;
    }
    // Multi-order check
    const multi = checkMultiOrderEligibility(order, myOrders);
    if (!multi.ok) {
      toast.error(multi.reason);
      return;
    }

    setAccepting(order.id);
    try {
      await base44.entities.Order.update(order.id, {
        driver_email: user.email,
        driver_name:  user.full_name || user.email,
        status: ORDER_STATUS_ON_DRIVER_ACCEPT,
      });

      if (multi.combined) {
        toast.success('Second job accepted! Deliver both orders on your route.');
      } else if (order.order_kind === 'courier') {
        toast.success('Courier job accepted! Head to the pickup point.');
      } else {
        toast.success('Job accepted! Head to the merchant.');
      }
      qc.invalidateQueries({ queryKey: ['driver-available'] });
      qc.invalidateQueries({ queryKey: ['driver-active', user?.email] });
    } catch (err) {
      // Another driver may have grabbed it, or the assignment/float reservation
      // failed server-side — surface it and refresh so stale state is cleared.
      toast.error(err?.message || 'Could not accept job — it may have been taken. Refreshing…');
      qc.invalidateQueries({ queryKey: ['driver-available'] });
    } finally {
      setAccepting(null);
    }
  };

  const rejectJob = (order) => {
    setRejectedIds((prev) => new Set([...prev, order.id]));
    toast.message('Job rejected — hidden for this session');
    // TODO(backend): record driver job rejections for matching quality
  };

  if (isLoading) return (
    <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-40 bg-muted rounded-2xl animate-pulse"/>)}</div>
  );

  if (isError) {
    return (
      <div className="bg-card rounded-2xl border border-destructive/30 p-8 text-center space-y-3">
        <p className="font-bold text-foreground">Could not load jobs</p>
        <p className="text-sm text-muted-foreground">{error?.message || 'Check that the API is running'}</p>
        <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-primary">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* New jobs alert banner */}
      {unassigned.length > 0 && activeOrders.length < 2 && (
        <div className="flex items-center justify-between bg-green-50 border border-green-300 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛵</span>
            <div>
              <p className="font-bold text-green-800 text-sm">
                {unassigned.length} job{unassigned.length > 1 ? 's' : ''} available!
              </p>
              <p className="text-xs text-green-700">Tap a job below to accept</p>
            </div>
          </div>
          {alertPlaying && (
            <button onClick={silenceAlert}
              className="text-xs font-semibold bg-green-200 text-green-800 px-3 py-1.5 rounded-xl hover:bg-green-300">
              🔕 Silence
            </button>
          )}
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Available Jobs</h1>
          <p className="text-muted-foreground text-sm">
            {unassigned.length} ready · {activeOrders.length}/2 active
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold ${
          blocked ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          <span className={`w-2 h-2 rounded-full ${blocked ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} />
          {blocked ? 'Blocked' : activeOrders.length >= 2 ? 'Full (2/2)' : 'Online'}
        </div>
      </div>

      {!accountActive && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">Account not activated yet</p>
            <p className="text-amber-800 text-xs mt-0.5">
              {verificationStatus !== 'approved'
                ? 'Your documents are under review (usually 24–72 hours).'
                : 'Complete the road safety quiz to start accepting jobs.'}
            </p>
            <Link
              to={verificationStatus !== 'approved' ? '/onboarding' : '/quiz'}
              className="inline-block mt-2 text-xs font-bold text-primary underline"
            >
              {verificationStatus !== 'approved' ? 'View status' : 'Take quiz'}
            </Link>
          </div>
        </div>
      )}

      {/* Wallet warning */}
      {balance < 0 && (
        <div className={`flex items-start gap-3 p-4 rounded-2xl ${
          blocked ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${blocked ? 'text-red-600' : 'text-yellow-600'}`} />
          <div>
            <p className={`font-semibold text-sm ${blocked ? 'text-red-800' : 'text-yellow-800'}`}>
              {blocked ? 'Account Blocked — Wallet Overdue' : 'Wallet Balance Low'}
            </p>
            <p className={`text-xs mt-0.5 ${blocked ? 'text-red-700' : 'text-yellow-700'}`}>
              Balance: ${balance.toFixed(2)} — {blocked
                ? 'Top up at any partner shop to resume.'
                : 'Account blocks at -$5.00.'}
            </p>
          </div>
        </div>
      )}

      {/* Multi-order info banner */}
      {activeOrders.length === 1 && (() => {
        const existing = activeOrders[0];
        const tenMinAgo = Date.now() - 10 * 60 * 1000;
        const pickedAt  = new Date(existing.updated_date).getTime();
        const tooOld    = pickedAt < tenMinAgo;
        return (
          <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
            tooOld ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'
          }`}>
            <Bike className={`w-4 h-4 shrink-0 mt-0.5 ${tooOld ? 'text-orange-600' : 'text-blue-600'}`} />
            <div>
              <p className={`font-semibold text-sm ${tooOld ? 'text-orange-800' : 'text-blue-800'}`}>
                {tooOld
                  ? 'Deliver your current order first'
                  : 'You can accept 1 more nearby order'}
              </p>
              <p className={`text-xs mt-0.5 ${tooOld ? 'text-orange-700' : 'text-blue-700'}`}>
                {tooOld
                  ? 'You picked up an order >10 min ago. Complete that delivery before accepting another.'
                  : 'The shop must be ≤1km away and the destination ≤2km from your current delivery.'}
              </p>
            </div>
          </div>
        );
      })()}

      {unassigned.length === 0 && (
        <div className="bg-card rounded-2xl border border-border p-14 text-center">
          <Bike className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-semibold text-foreground">No jobs available right now</p>
          <p className="text-sm text-muted-foreground mt-1">New orders appear here automatically</p>
        </div>
      )}

      <div className="space-y-3">
        {unassigned.map(order => {
          const multiCheck     = checkMultiOrderEligibility(order, myOrders);
          const isCash         = order.payment_method === 'cash_on_delivery';
          const debt           = isCash ? parseFloat((order.customer_subtotal || 0).toFixed(2)) : 0;
          const projBalance    = parseFloat((balance - debt).toFixed(2));
          const canTake        = !blocked && multiCheck.ok && activeOrders.length < 2;
          const isAccepting    = accepting === order.id;

          return (
            <div key={order.id} className={`bg-card rounded-2xl border overflow-hidden ${
              !canTake ? 'border-muted opacity-80' : multiCheck.combined ? 'border-blue-300' : 'border-border'
            }`}>
              {multiCheck.combined && (
                <div className="bg-blue-50 px-4 py-1.5 text-xs text-blue-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Good combo — nearby routes
                </div>
              )}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Store className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">
                        {order.order_kind === 'courier' ? 'DashZW Courier' : order.shop_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.created_date ? format(new Date(order.created_date), 'HH:mm') : '—'} · {PAYMENT_LABELS[order.payment_method] || order.payment_method}
                        {order.order_kind === 'courier' && order.required_vehicle_type && (
                          <span className="ml-1 capitalize">· {order.required_vehicle_type}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground">{formatUSD(order.total)}</p>
                    <p className="text-xs text-muted-foreground">{order.items?.length} item(s)</p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-xl p-3 space-y-1">
                  {order.items?.slice(0,3).map((item, i) => (
                    <p key={i} className="text-xs text-foreground">{item.quantity}× {item.name}</p>
                  ))}
                  {(order.items?.length||0) > 3 && (
                    <p className="text-xs text-muted-foreground">+{order.items.length-3} more</p>
                  )}
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" />
                  <span>
                    {order.order_kind === 'courier' ? (
                      <>
                        Pickup: {order.pickup_address || order.shop_address}
                        <br />
                        Drop-off: {order.delivery_address}
                      </>
                    ) : (
                      <>
                        {order.delivery_address}, {order.delivery_city}
                      </>
                    )}
                    {order.distance_km && <span className="ml-1 text-primary font-medium">· {order.distance_km.toFixed(1)} km</span>}
                  </span>
                </div>

                {/* Earnings + wallet impact */}
                <div className={`rounded-xl p-2.5 text-xs space-y-1 ${isCash ? 'bg-orange-50' : 'bg-green-50'}`}>
                  <div className="flex justify-between">
                    <span className={isCash ? 'text-orange-700 font-medium' : 'text-green-700 font-medium'}>
                      {isCash ? '💵 Cash on Delivery' : '💳 Online Payment'}
                    </span>
                    <span className="font-semibold text-green-700">
                      Keep ${(order.driver_earning||0).toFixed(2)} cash
                    </span>
                  </div>
                  {isCash && (
                    <div className="flex justify-between">
                      <span className="text-orange-700">Wallet after (you owe ${debt.toFixed(2)}):</span>
                      <span className={`font-bold ${projBalance < 0 ? 'text-red-700' : 'text-green-700'}`}>
                        ${projBalance.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>~{order.distance_km ? Math.round(order.distance_km*3+5) : '15-25'} min</span>
                  </div>
                </div>

                {/* Blocking reason */}
                {!canTake && (
                  <div className="flex items-start gap-2 bg-muted/50 rounded-xl p-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      {blocked ? 'Account blocked — top up wallet.' :
                       activeOrders.length >= 2 ? 'Already carrying 2 orders.' :
                       multiCheck.reason || 'Cannot accept this job right now.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="px-4 pb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => rejectJob(order)}
                  className="flex-1 font-semibold text-sm py-2.5 rounded-xl border border-border text-muted-foreground hover:bg-muted"
                >
                  Reject
                </button>
                <button onClick={() => acceptJob(order)} disabled={!canTake || isAccepting}
                  className={`flex-[2] font-semibold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 ${
                    canTake
                      ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}>
                  {isAccepting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Accepting…</>
                    : canTake ? 'Accept Order' : 'Cannot Accept'
                  }
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

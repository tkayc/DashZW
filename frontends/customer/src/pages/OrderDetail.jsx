import React, { useState, useEffect } from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, Package, Truck, MapPin, Phone, X, RotateCcw, MessageCircle, Camera, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { locationApi } from '@/api/location';
import PlatformMap from '@location/components/PlatformMap.jsx';
import InlineStarRating from '@/components/reviews/InlineStarRating';
import OrderChat from '@/components/chat/OrderChat';
import { calcAccurateETA, getTrafficLabel } from '@/api';
import { notifyOrderStatusChanged, notifyReplacementResolved } from '@/api';
import { toast } from 'sonner';
import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  normalizeOrderStatus,
  isTerminalOrderStatus,
} from '@/domain/orderStates';

const merchantStatusSteps = [
  { key: ORDER_STATUS.PENDING_ACCEPTANCE, label: 'Pending Acceptance', icon: Clock },
  { key: ORDER_STATUS.ACCEPTED, label: 'Accepted', icon: CheckCircle2 },
  { key: ORDER_STATUS.PREPARING, label: 'Preparing', icon: Package },
  { key: ORDER_STATUS.READY_FOR_PICKUP, label: 'Ready for Pickup', icon: Package },
  { key: ORDER_STATUS.DRIVER_ASSIGNED, label: 'Driver Assigned', icon: Truck },
  { key: ORDER_STATUS.PICKED_UP, label: 'Picked Up', icon: Truck },
  { key: ORDER_STATUS.IN_TRANSIT, label: 'In Transit', icon: Truck },
  { key: ORDER_STATUS.DELIVERED, label: 'Delivered', icon: CheckCircle2 },
  { key: ORDER_STATUS.COMPLETED, label: 'Completed', icon: CheckCircle2 },
];

/** Slim courier timeline — Accepted → Picked up → In transit → Delivered */
const courierStatusSteps = [
  { key: 'accepted', label: 'Accepted', icon: CheckCircle2, statuses: [ORDER_STATUS.READY_FOR_PICKUP, ORDER_STATUS.DRIVER_ASSIGNED] },
  { key: 'picked_up', label: 'Picked up', icon: Package, statuses: [ORDER_STATUS.PICKED_UP] },
  { key: 'in_transit', label: 'In transit', icon: Truck, statuses: [ORDER_STATUS.IN_TRANSIT] },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2, statuses: [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED] },
];

function courierStepIndex(status) {
  const idx = courierStatusSteps.findIndex((s) => s.statuses.includes(status));
  if (idx >= 0) return idx;
  if (status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.REFUNDED) return -1;
  return 0;
}

function isCourierOrder(order) {
  if (!order) return false;
  return (
    order.order_kind === 'courier' ||
    order.merchant_category === 'courier' ||
    String(order.special_notes || '').startsWith('COURIER|') ||
    order.shop_id === 'courier_platform' ||
    order.merchant_id === 'courier_platform'
  );
}

const statusColors = {
  [ORDER_STATUS.PENDING_ACCEPTANCE]: 'bg-secondary text-secondary-foreground',
  [ORDER_STATUS.ACCEPTED]: 'bg-primary/15 text-primary',
  [ORDER_STATUS.PREPARING]: 'bg-accent/15 text-accent',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'bg-accent/15 text-accent',
  [ORDER_STATUS.DRIVER_ASSIGNED]: 'bg-primary/15 text-primary',
  [ORDER_STATUS.PICKED_UP]: 'bg-primary/15 text-primary',
  [ORDER_STATUS.IN_TRANSIT]: 'bg-primary/15 text-primary',
  [ORDER_STATUS.DELIVERED]: 'bg-primary/20 text-primary',
  [ORDER_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
  [ORDER_STATUS.CANCELLED]: 'bg-destructive/15 text-destructive',
  [ORDER_STATUS.REFUNDED]: 'bg-destructive/15 text-destructive',
};

function normalizeItems(items = []) {
  return items.map(item => ({
    ...item,
    packed_quantity: Math.max(0, Math.min(item.quantity || 0, item.packed_quantity || 0)),
    unavailable: !!item.unavailable,
    replacement_pending: !!item.replacement_pending,
    replacement_options: Array.isArray(item.replacement_options) ? item.replacement_options : [],
  }));
}

function recalcOrderTotals(order, items) {
  const partnerSubtotal = parseFloat(items
    .filter(i => !i.unavailable)
    .reduce((sum, i) => sum + (i.price * i.quantity), 0)
    .toFixed(2));
  const platformFee = parseFloat((partnerSubtotal * 0.05).toFixed(2));
  const customerSubtotal = parseFloat((partnerSubtotal + platformFee).toFixed(2));
  const total = parseFloat((customerSubtotal + (order.delivery_fee || 0) - (order.discount_amount || 0)).toFixed(2));
  return {
    partner_subtotal: partnerSubtotal,
    platform_fee: platformFee,
    customer_subtotal: customerSubtotal,
    partner_payout: partnerSubtotal,
    total: Math.max(0, total),
  };
}

export default function OrderDetail() {
  const { id: orderId } = useParams();
  const navigate = useNavigate();
  const [showChat, setShowChat]     = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const [tracking, setTracking] = useState(null);

  useEffect(() => {
    if (!orderId) return;
    const load = () => locationApi.getOrderTracking(orderId).then(setTracking).catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [orderId]);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const orders = await base44.entities.Order.filter({ id: orderId });
      return orders[0];
    },
    enabled: !!orderId,
  });

  // Check if driver has another active order (multi-delivery) to show on map
  const { data: siblingOrder } = useQuery({
    queryKey: ['order-sibling', order?.driver_email, orderId],
    queryFn: async () => {
      if (!order?.driver_email) return null;
      const { getCollection } = await import('@/api');
      const all = getCollectionSync('Order');
      return all.find(o =>
        o.driver_email === order.driver_email &&
        o.id !== orderId &&
        !isTerminalOrderStatus(o.status)
      ) || null;
    },
    enabled: !!order?.driver_email,
    refetchInterval: 5000,
  });

  const { data: existingReview } = useQuery({
    queryKey: ['review', orderId],
    queryFn: async () => {
      const reviews = await base44.entities.Review.filter({ order_id: orderId });
      return reviews[0] || null;
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="px-4 pt-6">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 px-4">
        <p className="text-4xl mb-3">😕</p>
        <p className="font-semibold">Order not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/orders')}>View Orders</Button>
      </div>
    );
  }

  const status = normalizeOrderStatus(order.status);
  const isCourier = isCourierOrder(order);
  const statusSteps = isCourier ? courierStatusSteps : merchantStatusSteps;
  const currentStepIndex = isCourier
    ? courierStepIndex(status)
    : statusSteps.findIndex((s) => s.key === status);
  const normalizedItems = normalizeItems(order.items);
  const packProgress = order.pack_progress || {
    packed_units: normalizedItems.reduce((sum, i) => sum + (i.packed_quantity || 0), 0),
    total_units: normalizedItems.reduce((sum, i) => sum + (i.quantity || 0), 0),
  };
  const pendingAdjustments = (order.adjustment_requests || []).filter(r => r.status === 'pending');

  // ── Slim courier tracking page ────────────────────────────────────────────
  if (isCourier) {
    const vehicle = (order.required_vehicle_type || order.pack_progress?.courier_meta?.required_vehicle_type || 'motorbike')
      .replace(/_/g, ' ');
    const packageLabel =
      order.package_description ||
      order.pack_progress?.courier_meta?.package_description ||
      order.items?.[0]?.name ||
      'Package';
    const pickupLine = order.pickup_address || order.shop_address || 'Pickup';
    const dropoffLine = [order.delivery_address, order.delivery_city].filter(Boolean).join(', ');
    const courierLabel =
      currentStepIndex >= 0
        ? courierStatusSteps[currentStepIndex].label
        : (ORDER_STATUS_LABELS[status] || status);
    const showMap = [
      ORDER_STATUS.READY_FOR_PICKUP,
      ORDER_STATUS.DRIVER_ASSIGNED,
      ORDER_STATUS.PICKED_UP,
      ORDER_STATUS.IN_TRANSIT,
    ].includes(status);
    const showCode = showMap && !!order.delivery_code;

    return (
      <div className="px-4 pt-6 pb-8 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-foreground">Courier</h1>
            <p className="text-xs text-muted-foreground truncate">
              #{order.id?.slice(-8)} · {vehicle}
            </p>
          </div>
          <Badge className={`${statusColors[status] || 'bg-primary/15 text-primary'} px-3 py-1 text-xs font-semibold rounded-xl capitalize`}>
            {courierLabel}
          </Badge>
        </div>

        {/* Timeline — 4 steps only */}
        {status !== ORDER_STATUS.CANCELLED && status !== ORDER_STATUS.REFUNDED && (
          <div className="bg-card rounded-2xl p-4 border border-border/50 mb-4">
            <div className="space-y-3">
              {courierStatusSteps.map((step, idx) => {
                const isCompleted = currentStepIndex >= 0 && idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                const StepIcon = step.icon;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <StepIcon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-sm ${
                        isCurrent
                          ? 'font-bold text-foreground'
                          : isCompleted
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </span>
                    {isCurrent && <div className="w-2 h-2 rounded-full bg-primary animate-pulse ml-auto" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delivery code */}
        {showCode && (
          <div className="bg-primary rounded-2xl p-5 text-primary-foreground text-center mb-4">
            <p className="text-sm font-medium opacity-80 mb-1">Delivery code</p>
            <p className="text-5xl font-bold tracking-widest">{order.delivery_code}</p>
            <p className="text-xs opacity-70 mt-2">Share with the recipient at drop-off</p>
          </div>
        )}

        {/* Map */}
        {showMap && (
          <div className="mb-4">
            <PlatformMap
              height={240}
              merchant={{
                lat: order.pickup_lat || order.shop_lat,
                lng: order.pickup_lng || order.shop_lng,
                label: 'Pickup',
              }}
              customer={
                order.dest_lat
                  ? { lat: order.dest_lat, lng: order.dest_lng, label: 'Drop-off' }
                  : null
              }
              driver={
                order.driver_lat
                  ? { lat: order.driver_lat, lng: order.driver_lng, label: order.driver_name || 'Courier' }
                  : null
              }
              route={tracking?.routes?.[0]?.polyline || []}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {order.driver_name
                ? `${order.driver_name} · ${courierLabel}`
                : 'Waiting for a courier…'}
              {tracking?.eta_mins != null ? ` · ETA ~${tracking.eta_mins} min` : ''}
            </p>
            {order.driver_phone && (
              <a
                href={`tel:${order.driver_phone}`}
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-primary"
              >
                <Phone className="w-3.5 h-3.5" /> Call courier
              </a>
            )}
          </div>
        )}

        {/* Essentials only */}
        <div className="bg-card rounded-2xl p-4 border border-border/50 space-y-3">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase">Pickup</p>
              <p className="text-foreground">{pickupLine}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase">Drop-off</p>
              <p className="text-foreground">{dropoffLine || '—'}</p>
            </div>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Package</span>
            <span className="font-medium text-foreground text-right max-w-[60%]">{packageLabel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Vehicle</span>
            <span className="font-medium capitalize">{vehicle}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>Courier fee</span>
            <span>
              {formatUSD(
                (order.delivery_fee || 0) > 0
                  ? order.delivery_fee
                  : (order.total || 0) + (order.wallet_applied || 0)
              )}
            </span>
          </div>
        </div>

        {(status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.COMPLETED) && (
          <div className="mt-4">
            <InlineStarRating
              order={order}
              label="Rate courier"
              alreadyRated={reviewed || !!existingReview}
              onSubmitted={() => setReviewed(true)}
            />
          </div>
        )}
      </div>
    );
  }

  const resolveReplacement = async (request, option) => {
    const items = normalizeItems(order.items);
    const itemIndex = items.findIndex(i => i.menu_item_id === request.item_menu_id);
    if (itemIndex < 0) return;

    const oldItem = items[itemIndex];
    const oldLineTotal = parseFloat(((oldItem.price || 0) * (oldItem.quantity || 0)).toFixed(2));
    let nextItem = { ...oldItem, replacement_pending: false, replacement_options: [] };
    let actionLabel = 'Removed';

    if (option?.type === 'swap') {
      nextItem = {
        ...nextItem,
        menu_item_id: option.menu_item_id,
        name: option.name,
        price: option.price,
        unavailable: false,
        swapped_from_name: oldItem.name,
      };
      actionLabel = `Swap to ${option.name}`;
    } else {
      nextItem = { ...nextItem, unavailable: true };
    }

    items[itemIndex] = nextItem;

    const newLineTotal = parseFloat(((nextItem.unavailable ? 0 : nextItem.price) * (nextItem.quantity || 0)).toFixed(2));
    const refundAmount = Math.max(0, parseFloat((oldLineTotal - newLineTotal).toFixed(2)));
    const updates = recalcOrderTotals(order, items);
    const requests = (order.adjustment_requests || []).map(r =>
      r.id === request.id
        ? { ...r, status: 'resolved', resolved_date: new Date().toISOString(), decision: option?.type === 'swap' ? 'swap' : 'remove' }
        : r
    );

    if (refundAmount > 0 && order.payment_method !== 'cash_on_delivery') {
      const { creditCustomerRefundForAdjustment } = await import('@/api');
      await creditCustomerRefundForAdjustment(
        order.id,
        refundAmount,
        `Order adjustment: ${oldItem.name} - Order #${order.id.slice(-6)}`
      );
    }

    await base44.entities.Order.update(order.id, {
      ...updates,
      items,
      adjustment_requests: requests,
      refunded_amount: (order.refunded_amount || 0) + (order.payment_method !== 'cash_on_delivery' ? refundAmount : 0),
    });

    notifyReplacementResolved(order, request.item_name, actionLabel);
    toast.success(
      option?.type === 'swap'
        ? `Swapped "${request.item_name}" with "${option.name}"`
        : `Removed "${request.item_name}" from your order`
    );
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/orders')} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Order Details</h1>
          <p className="text-xs text-muted-foreground">#{order.id?.slice(-8)}</p>
        </div>
      </div>

      {/* Status Badge + chat */}
      <div className="flex items-center justify-between mb-5 gap-2">
        <Badge className={`${statusColors[status] || statusColors[ORDER_STATUS.PENDING_ACCEPTANCE]} px-3 py-1 text-xs font-semibold rounded-xl`}>
          {ORDER_STATUS_LABELS[status] || status}
        </Badge>
        {!isTerminalOrderStatus(status) && (
          <button
            type="button"
            onClick={() => setShowChat(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-xl hover:bg-primary/15"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(order.created_date).toLocaleDateString('en-ZW', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {packProgress.total_units > 0 && [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.READY_FOR_PICKUP].includes(status) && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-4">
          <p className="text-sm font-semibold text-blue-800">Live packing: {packProgress.packed_units}/{packProgress.total_units} packed</p>
          <p className="text-xs text-blue-700 mt-0.5">Your shop is packing in real time. You will be notified if an item is out of stock.</p>
        </div>
      )}

      {pendingAdjustments.length > 0 && (
        <div className="space-y-3 mb-4">
          {pendingAdjustments.map(req => (
            <div key={req.id} className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <p className="text-sm font-semibold text-orange-800">
                "{req.item_name}" is unavailable. Choose what you want:
              </p>
              <div className="mt-3 space-y-2">
                {(req.options || []).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => resolveReplacement(req, { type: 'swap', ...opt, menu_item_id: opt.id })}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white border border-orange-200 hover:bg-orange-100"
                  >
                    <p className="text-sm font-semibold text-foreground">{opt.name}</p>
                    <p className="text-xs text-muted-foreground">Swap item · {formatUSD((opt.price || 0))}</p>
                  </button>
                ))}
                <button
                  onClick={() => resolveReplacement(req, { type: 'remove' })}
                  className="w-full text-left px-3 py-2 rounded-xl bg-red-100 border border-red-200 hover:bg-red-200 text-red-700 text-sm font-semibold"
                >
                  Remove this item from my order
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ETA Banner — only shown once driver marks on_the_way */}
      {status === ORDER_STATUS.IN_TRANSIT && (() => {
        const eta = calcAccurateETA(order);
        if (!eta) return null;
        return (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-sm font-bold text-foreground">{eta.label}</p>
                  <p className="text-xs text-muted-foreground">Arriving by {eta.etaTime}</p>
                </div>
              </div>
              {eta.traffic && (
                <span className={`text-xs font-semibold ${eta.traffic.color || ''}`}>
                  {eta.traffic.emoji} {eta.traffic.label}
                </span>
              )}
            </div>
            {(eta.breakdown?.prep > 0 || eta.breakdown?.travel > 0) && (
              <div className="flex gap-3 mt-1">
                {eta.breakdown.prep > 0 && <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">🍳 Prep ~{eta.breakdown.prep}m</span>}
                <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">🛵 Travel ~{eta.breakdown.travel}m</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Customer cancel — only within 2 min of placing */}
      {status === ORDER_STATUS.PENDING_ACCEPTANCE && (() => {
        const age = (Date.now() - new Date(order.created_date).getTime()) / 1000;
        if (age > 120) return null;
        const secsLeft = Math.ceil(120 - age);
        return (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
            <p className="text-xs text-orange-800 flex-1">You can cancel within <strong>{secsLeft}s</strong></p>
            <button
              onClick={async () => {
                try {
                  const { cancelOwnOrder } = await import('@/api');
                  await cancelOwnOrder(order.id);
                  notifyOrderStatusChanged(order, ORDER_STATUS.CANCELLED);
                  toast.success('Order cancelled');
                } catch (e) {
                  toast.error(e.message || 'Could not cancel');
                }
              }}
              className="flex items-center gap-1 bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        );
      })()}

      {/* Status summary */}
      <div className="bg-card rounded-2xl p-4 border border-border/50 mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Merchant status
        </p>
        <p className="text-sm font-semibold text-foreground">
          {ORDER_STATUS_LABELS[status] || status}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {order.merchant_name || order.shop_name}
          {order.branch_id ? ` · Branch ${String(order.branch_id).slice(-4)}` : ''}
        </p>
      </div>

      {/* Order Timeline */}
      {status !== ORDER_STATUS.CANCELLED && status !== ORDER_STATUS.REFUNDED && (
        <div className="bg-card rounded-2xl p-4 border border-border/50 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Order timeline
          </p>
          <div className="space-y-3">
            {statusSteps.map((step, idx) => {
              const isCompleted = idx <= currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              const StepIcon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    <StepIcon className="w-4 h-4" />
                  </div>
                  <span className={`text-sm ${
                    isCurrent ? 'font-bold text-foreground' : isCompleted ? 'font-medium text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.label}
                  </span>
                  {isCurrent && (
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse ml-auto" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Driver tracking + live map */}
      {[ORDER_STATUS.PICKED_UP, ORDER_STATUS.IN_TRANSIT, ORDER_STATUS.DRIVER_ASSIGNED].includes(status) && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Driver tracking
            </p>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Navigation className="w-3 h-3" /> Live map
            </span>
          </div>
          {siblingOrder && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-2">
              <span className="text-sm">🟢</span>
              <p className="text-xs text-blue-700">
                Driver is also delivering to <strong>{siblingOrder.customer_name}</strong> — both destinations shown on map
              </p>
            </div>
          )}
          <PlatformMap
            height={260}
            merchant={order.shop_lat ? { lat: order.shop_lat, lng: order.shop_lng, label: order.shop_name } : null}
            customer={order.dest_lat ? { lat: order.dest_lat, lng: order.dest_lng, label: order.delivery_address } : null}
            driver={order.driver_lat ? { lat: order.driver_lat, lng: order.driver_lng, label: order.driver_name || 'Driver' } : null}
            route={tracking?.routes?.[0]?.polyline || []}
          />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>{order.driver_lat ? '🛵 Driver location updating live' : '⏳ Waiting for driver location…'}</span>
            {tracking?.eta_mins != null && <span>ETA ~{tracking.eta_mins} min</span>}
          </div>
          {order.driver_phone && (
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" className="rounded-xl flex-1" asChild>
                <a href={`tel:${order.driver_phone}`}>
                  <Phone className="w-3.5 h-3.5 mr-1" /> Call driver
                </a>
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl flex-1" onClick={() => setShowChat(true)}>
                <MessageCircle className="w-3.5 h-3.5 mr-1" /> Chat
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="bg-card rounded-2xl p-4 border border-border/50 mb-4">
        <h3 className="font-semibold text-foreground mb-3">{order.shop_name}</h3>
        <div className="space-y-2">
          {normalizedItems.map((item, idx) => (
            <div key={idx} className={`flex justify-between text-sm items-start gap-2 ${item.unavailable ? 'opacity-70' : ''}`}>
              <div className="flex-1 min-w-0">
                <span className={item.unavailable ? 'line-through text-red-500' : 'text-muted-foreground'}>
                  {item.quantity}x {item.name}
                </span>
                {item.swapped_from_name && (
                  <span className="block text-xs text-blue-600 font-medium mt-0.5">
                    🔄 Replaced {item.swapped_from_name}
                  </span>
                )}
                {!item.unavailable && [ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING, ORDER_STATUS.READY_FOR_PICKUP].includes(status) && (
                  <span className="block text-xs text-blue-600 font-medium mt-0.5">
                    Packed {item.packed_quantity || 0}/{item.quantity}
                  </span>
                )}
                {item.unavailable && (
                  <span className="block text-xs text-red-500 font-medium mt-0.5">
                    ❌ Unavailable — {order.payment_method === 'cash_on_delivery' ? 'removed from total' : 'refunded to your wallet'}
                  </span>
                )}
              </div>
              <span className={`font-medium shrink-0 ${item.unavailable ? 'line-through text-red-400' : ''}`}>
                ${(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
          <Separator className="my-2" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Items subtotal</span>
            <span>${(order.partner_subtotal ?? order.total)?.toFixed(2)}</span>
          </div>
          {order.platform_fee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform fee (5%)</span>
              <span>${order.platform_fee?.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery
              {order.distance_km ? ` (${order.distance_km.toFixed(1)} km)` : ''}
            </span>
            <span>{order.delivery_fee ? formatUSD(order.delivery_fee) : 'Free'}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>−${order.discount_amount?.toFixed(2)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>${order.total?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Delivery Info */}
      <div className="bg-card rounded-2xl p-4 border border-border/50 mb-4">
        <h3 className="font-semibold text-foreground mb-3">Delivery Info</h3>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <span className="text-muted-foreground">
              {order.delivery_address}{order.delivery_city ? `, ${order.delivery_city}` : ''}
            </span>
          </div>
          {order.customer_phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{order.customer_phone}</span>
            </div>
          )}
          {order.driver_name && (
            <div className="mt-3 p-3 bg-primary/5 rounded-xl space-y-2">
              <p className="text-xs text-muted-foreground">Driver information</p>
              <p className="font-semibold text-sm">{order.driver_name}</p>
              {order.driver_phone && (
                <a
                  href={`tel:${order.driver_phone}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
                >
                  <Phone className="w-3.5 h-3.5" /> Call driver
                </a>
              )}
              <button
                type="button"
                onClick={() => setShowChat(true)}
                className="ml-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delivery OTP */}
      {[ORDER_STATUS.IN_TRANSIT, ORDER_STATUS.PICKED_UP, ORDER_STATUS.DRIVER_ASSIGNED].includes(status) && (
        <div className="bg-primary rounded-2xl p-5 text-primary-foreground text-center mb-4">
          <p className="text-sm font-medium opacity-80 mb-1">Delivery OTP</p>
          <p className="text-5xl font-bold tracking-widest">{order.delivery_code || '····'}</p>
          <p className="text-xs opacity-70 mt-2">Give this code to the driver to confirm delivery</p>
        </div>
      )}

      {/* Delivery photo placeholder */}
      {(status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.COMPLETED) && (
        <div className="bg-card rounded-2xl border border-dashed border-border p-4 mb-4 text-center">
          <Camera className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Delivery photo</p>
          <p className="text-xs text-muted-foreground mt-1">
            Proof-of-delivery photos will appear here.
          </p>
          {/* TODO(backend): delivery_photos storage */}
        </div>
      )}

      {/* Post-delivery experience */}
      {(status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.COMPLETED) && (
        <div className="mt-4 space-y-3">
          <div className="bg-card rounded-2xl border border-border/50 p-4">
            <p className="font-semibold text-sm text-foreground mb-2">Receipt</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatUSD(order.customer_subtotal || order.total)}</span>
              </div>
              {order.delivery_fee > 0 && (
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span>{formatUSD(order.delivery_fee)}</span>
                </div>
              )}
              {order.driver_tip > 0 && (
                <div className="flex justify-between">
                  <span>Driver tip</span>
                  <span>{formatUSD(order.driver_tip)}</span>
                </div>
              )}
              {order.wallet_applied > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>Wallet credit applied</span>
                  <span>−{formatUSD(order.wallet_applied)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border mt-1">
                <span>{order.wallet_applied > 0 ? 'Amount due' : 'Total paid'}</span>
                <span>{formatUSD(order.total)}</span>
              </div>
              {order.wallet_applied > 0 && (
                <p className="text-[10px] text-blue-700">
                  {formatUSD(order.wallet_applied)} paid from your DashZW wallet
                </p>
              )}
              <p className="text-[10px] pt-1 capitalize">
                Paid via {(order.payment_method || '').replace(/_/g, ' ')} · #{order.id?.slice(-8)}
              </p>
            </div>
            {/* TODO(backend): PDF receipt download */}
          </div>

          <div className="mt-1">
            <InlineStarRating
              order={order}
              label="Rate your experience"
              alreadyRated={reviewed || !!existingReview}
              onSubmitted={() => setReviewed(true)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                // Reorder: navigate home with intent — full flow on Orders page
                navigate('/orders');
                toast.message('Use Reorder on your orders list');
              }}
              className="py-3 rounded-2xl border border-border text-sm font-semibold hover:bg-muted/40"
            >
              Reorder
            </button>
            <button
              type="button"
              onClick={() => {
                toast.message('Issue report', {
                  description: 'Support tickets will open here. For now use Help & Support in Profile.',
                });
                // TODO(backend): Create support ticket linked to order_id
              }}
              className="py-3 rounded-2xl border border-border text-sm font-semibold hover:bg-muted/40"
            >
              Report issue
            </button>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-4">
            <p className="font-semibold text-sm text-foreground mb-2">Add a tip for your driver</p>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    toast.message('Tip placeholder', {
                      description: `${formatUSD(t)} tip will be sent when payments are connected.`,
                    })
                  }
                  className="flex-1 py-2 rounded-xl bg-muted text-sm font-semibold"
                >
                  {formatUSD(t)}
                </button>
              ))}
            </div>
            {/* TODO(payments): Post-delivery tip charge */}
          </div>
        </div>
      )}

      {showChat && (
        <OrderChat order={order} onClose={() => setShowChat(false)} />
      )}
    </div>
  );
}
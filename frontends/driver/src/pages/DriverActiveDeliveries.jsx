import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { MapPin, Phone, PackageCheck, ClipboardList, Map, KeyRound, Loader2, Navigation, Camera, PenLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatUSD } from '@/lib/formatCurrency';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import DeliveryMap from '@/components/map/DeliveryMap';
import { useDriverLocation } from '@/hooks/useDriverLocation';
import { awardPoints } from '@/api';
import DriverSafety from '@/components/driver/DriverSafety';
import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  DRIVER_STATUS_FLOW,
  normalizeOrderStatus,
  isTerminalOrderStatus,
} from '@/domain/orderStates';

const STATUS_COLOR = {
  [ORDER_STATUS.DRIVER_ASSIGNED]: 'bg-indigo-100 text-indigo-700',
  [ORDER_STATUS.PICKED_UP]: 'bg-indigo-100 text-indigo-700',
  [ORDER_STATUS.IN_TRANSIT]: 'bg-cyan-100 text-cyan-700',
  [ORDER_STATUS.DELIVERED]: 'bg-green-100 text-green-700',
  [ORDER_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
};

const PAYMENT_LABELS = {
  ecocash: 'EcoCash', onemoney: 'OneMoney', innbucks: 'InnBucks', cash_on_delivery: 'Cash on Delivery',
};

function DeliveryCodePanel({ codeInput, setCodeInput, verifying, onConfirm, onCancel, compact = false }) {
  return (
    <div className={compact ? 'space-y-3' : 'px-4 py-4 space-y-4'}>
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-green-600/10 flex items-center justify-center shrink-0">
          <KeyRound className="w-4 h-4 text-green-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Delivery code</p>
          <p className="text-xs text-muted-foreground">Ask the customer for their 4-digit code</p>
        </div>
      </div>
      <Input
        placeholder="• • • •"
        value={codeInput}
        onChange={e => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="text-center text-3xl font-bold tracking-[0.5em] rounded-2xl bg-background h-14 border-2 focus-visible:ring-green-600/30"
        maxLength={4}
        inputMode="numeric"
        autoComplete="one-time-code"
      />
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={verifying || codeInput.length !== 4}
          className={`${onCancel ? 'flex-1' : 'w-full'} py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-sm`}
        >
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
          Confirm delivery
        </button>
      </div>
    </div>
  );
}

function ActiveDeliveryCard({ order, onUpdateStatus, immersive = false }) {
  const navigate = useNavigate();
  const [showMap, setShowMap] = useState(false);
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const driverPos = useDriverLocation(order.id, true);

  const status = normalizeOrderStatus(order.status);
  const nextStep = DRIVER_STATUS_FLOW[status];
  const isInTransit = status === ORDER_STATUS.IN_TRANSIT;

  const handleNextStatus = () => {
    if (!nextStep) return;
    if (nextStep.next === ORDER_STATUS.DELIVERED) {
      setShowCodeEntry(true);
      return;
    }
    onUpdateStatus(order, nextStep.next);
  };

  const handleDeliverWithCode = async () => {
    if (codeInput.length !== 4) { toast.error('Enter the 4-digit code from the customer'); return; }
    setVerifying(true);
    await new Promise(r => setTimeout(r, 500)); // small delay for UX
    if (codeInput !== order.delivery_code) {
      toast.error('Incorrect code. Ask the customer for their delivery code.');
      setVerifying(false);
      return;
    }
    setVerifying(false);
    setShowCodeEntry(false);
    onUpdateStatus(order, ORDER_STATUS.DELIVERED);
  };

  if (isInTransit) {
    return (
      <div
        className={`flex flex-col bg-card border border-border overflow-hidden border-l-4 border-l-cyan-500 shadow-sm ${
          immersive
            ? '-mx-4 -mt-4 lg:-mx-6 lg:-mt-6 min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100dvh-3rem)] rounded-none lg:rounded-2xl'
            : 'rounded-2xl min-h-[min(72dvh,640px)]'
        }`}
      >
        <div className="shrink-0 px-4 py-3 border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-foreground">{order.customer_name || 'Customer'}</p>
                <Badge className={`text-[10px] ${STATUS_COLOR[status] || ''}`}>
                  {ORDER_STATUS_LABELS[status]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {order.delivery_address}, {order.delivery_city}
                {order.distance_km != null && <span className="ml-1 text-foreground/70">· {order.distance_km.toFixed(1)} km</span>}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">You earn</p>
              <p className="text-sm font-bold text-green-700">{formatUSD(order.driver_earning)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            {order.customer_phone && (
              <a
                href={`tel:${order.customer_phone}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg"
              >
                <Phone className="w-3.5 h-3.5" />
                Call
              </a>
            )}
            <button
              type="button"
              onClick={() => navigate(`/navigate/${order.id}`)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted px-2.5 py-1.5 rounded-lg hover:bg-muted/80 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              Turn-by-turn
            </button>
            {order.delivery_notes && (
              <span className="text-[11px] text-muted-foreground truncate flex-1" title={order.delivery_notes}>
                💬 {order.delivery_notes}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-[240px] relative bg-muted/30">
          <DeliveryMap
            shopAddress={order.shop_address || order.shop_name}
            deliveryAddress={`${order.delivery_address}, ${order.delivery_city}`}
            driverPosition={driverPos}
            className="h-full w-full"
            rounded={false}
          />
          {driverPos && (
            <div className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 bg-card/95 backdrop-blur-sm border border-border px-2.5 py-1.5 rounded-full text-[11px] font-medium text-foreground shadow-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live GPS
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border bg-card shadow-[0_-12px_40px_rgba(0,0,0,0.06)]">
          <DeliveryCodePanel
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            verifying={verifying}
            onConfirm={handleDeliverWithCode}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden border-l-4 border-l-accent">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-foreground">{order.customer_name || 'Customer'}</p>
            <p className="text-xs text-muted-foreground">{order.merchant_name || order.shop_name} · {PAYMENT_LABELS[order.payment_method]}</p>
          </div>
          <div className="text-right">
            <Badge className={`text-xs ${STATUS_COLOR[status] || ''}`}>
              {ORDER_STATUS_LABELS[status] || status?.replace(/_/g, ' ')}
            </Badge>
            <p className="text-xs text-green-700 font-semibold mt-1">
              Earn ${order.driver_earning?.toFixed(2) || '—'}
            </p>
          </div>
        </div>

        <div className="bg-muted/50 rounded-xl p-3 space-y-1">
          {order.items?.map((item, i) => (
            <p key={i} className={`text-xs text-foreground ${item.unavailable ? 'line-through opacity-50' : ''}`}>
              {item.quantity}× {item.name}
            </p>
          ))}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
            <span>{order.delivery_address}, {order.delivery_city}
              {order.distance_km && <span className="ml-1">({order.distance_km.toFixed(1)} km)</span>}
            </span>
          </div>
          {order.customer_phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
              <a href={`tel:${order.customer_phone}`} className="text-primary font-medium">{order.customer_phone}</a>
            </div>
          )}
          {order.delivery_notes && (
            <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">💬 {order.delivery_notes}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowMap(v => !v)} className="flex items-center gap-1.5 text-xs text-primary font-medium">
            <Map className="w-3.5 h-3.5" />
            {showMap ? 'Hide Map' : 'Show Map'}
            {driverPos && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/navigate/${order.id}`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium"
          >
            <Navigation className="w-3.5 h-3.5" /> Navigate
          </button>
          <button
            type="button"
            onClick={() => toast.message('Photo proof upload coming soon')}
            className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium"
          >
            <Camera className="w-3.5 h-3.5" /> Photo proof
          </button>
          <button
            type="button"
            onClick={() => toast.message('Customer signature capture coming soon')}
            className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium"
          >
            <PenLine className="w-3.5 h-3.5" /> Signature
          </button>
        </div>
        {/* TODO(maps): navigation · TODO(storage): photo proof · TODO(backend): signature */}
        {showMap && (
          <DeliveryMap
            shopAddress={order.shop_address || order.shop_name}
            deliveryAddress={`${order.delivery_address}, ${order.delivery_city}`}
            driverPosition={driverPos}
          />
        )}

        <div className="flex gap-2 pt-1">
          {nextStep && nextStep.next !== ORDER_STATUS.DELIVERED && (
            <button onClick={handleNextStatus}
              className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-foreground font-semibold text-sm py-2.5 rounded-xl hover:bg-accent/90 transition-colors">
              <PackageCheck className="w-4 h-4" /> {nextStep.label}
            </button>
          )}
        </div>

        {showCodeEntry && (
          <div className="bg-muted/50 rounded-xl p-4">
            <DeliveryCodePanel
              compact
              codeInput={codeInput}
              setCodeInput={setCodeInput}
              verifying={verifying}
              onConfirm={handleDeliverWithCode}
              onCancel={() => { setShowCodeEntry(false); setCodeInput(''); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function DriverActiveDeliveries() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: orders = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['driver-active', user?.email],
    queryFn: () => base44.entities.Order.filter({ driver_email: user.email }, '-created_date', 100),
    enabled: !!user?.email,
  });

  const active = orders.filter((o) => !isTerminalOrderStatus(o.status));
  const hasInTransit = active.some((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.IN_TRANSIT);
  const completed = orders
    .filter((o) => {
      const s = normalizeOrderStatus(o.status);
      return s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.COMPLETED;
    })
    .slice(0, 10);

  const updateStatus = async (order, status) => {
    const persistStatus = status === ORDER_STATUS.DELIVERED ? ORDER_STATUS.COMPLETED : status;
    await base44.entities.Order.update(order.id, {
      status: persistStatus,
      ...(status === ORDER_STATUS.DELIVERED ? { delivered_at: new Date().toISOString() } : {}),
    });
    if (status === ORDER_STATUS.DELIVERED) {
      const orderTotal = order.total_before_wallet ?? (order.customer_subtotal || 0) + (order.delivery_fee || 0);
      if (order.customer_email && orderTotal > 0) {
        await awardPoints(order.customer_email, orderTotal);
      }
      toast.success('Order delivered! Great job 🎉');
    } else {
      toast.success('Status updated!');
    }
    qc.invalidateQueries({ queryKey: ['driver-active', user?.email] });
    qc.invalidateQueries({ queryKey: ['driver-available'] });
  };

  if (isLoading) return <div className="space-y-3">{[1,2].map(i=><div key={i} className="h-48 bg-muted rounded-2xl animate-pulse"/>)}</div>;

  if (isError) {
    return (
      <div className="bg-card rounded-2xl border border-destructive/30 p-8 text-center space-y-3">
        <p className="font-bold text-foreground">Could not load deliveries</p>
        <p className="text-sm text-muted-foreground">{error?.message || 'Check that the API is running'}</p>
        <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-primary">Try again</button>
      </div>
    );
  }

  return (
    <div className={hasInTransit ? 'space-y-3' : 'space-y-5'}>
      {!hasInTransit && (
        <div>
          <h1 className="text-xl font-bold text-foreground">My Deliveries</h1>
          <p className="text-muted-foreground text-sm">{active.length} active · {completed.length} completed</p>
        </div>
      )}

      {active.length === 0 && (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-semibold text-foreground">No active deliveries</p>
          <p className="text-sm text-muted-foreground mt-1">Accept a job from the Available Jobs tab</p>
        </div>
      )}

      {active.map(order => (
        <ActiveDeliveryCard
          key={order.id}
          order={order}
          onUpdateStatus={updateStatus}
          immersive={hasInTransit && normalizeOrderStatus(order.status) === ORDER_STATUS.IN_TRANSIT}
        />
      ))}

      {completed.length > 0 && (
        <div>
          <h2 className="font-bold text-foreground mb-3">Completed</h2>
          <div className="space-y-2">
            {completed.map(order => (
              <div key={order.id} className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between opacity-70">
                <div>
                  <p className="font-semibold text-sm text-foreground">{order.customer_name || 'Customer'}</p>
                  <p className="text-xs text-muted-foreground">{order.shop_name} · {order.created_date ? format(new Date(order.created_date), 'HH:mm') : '—'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-green-700">+${order.driver_earning?.toFixed(2) || '—'}</p>
                  <Badge className="text-xs bg-green-100 text-green-700">Delivered</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { ClipboardList, Minus, Plus, PackageCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { refundToCustomerWallet, notifyReplacementNeeded } from '@/api';
import { useOrderAlertSound } from '@/hooks/useOrderAlertSound';
import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  MERCHANT_STATUS_FLOW,
  normalizeOrderStatus,
  isTerminalOrderStatus,
} from '@/domain/orderStates';

const STATUS_COLORS = {
  [ORDER_STATUS.CREATED]: 'bg-slate-100 text-slate-700',
  [ORDER_STATUS.PENDING_ACCEPTANCE]: 'bg-yellow-100 text-yellow-700',
  [ORDER_STATUS.ACCEPTED]: 'bg-blue-100 text-blue-700',
  [ORDER_STATUS.PREPARING]: 'bg-orange-100 text-orange-700',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'bg-purple-100 text-purple-700',
  [ORDER_STATUS.DRIVER_ASSIGNED]: 'bg-indigo-100 text-indigo-700',
  [ORDER_STATUS.PICKED_UP]: 'bg-indigo-100 text-indigo-700',
  [ORDER_STATUS.IN_TRANSIT]: 'bg-cyan-100 text-cyan-700',
  [ORDER_STATUS.DELIVERED]: 'bg-green-100 text-green-700',
  [ORDER_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
  [ORDER_STATUS.CANCELLED]: 'bg-red-100 text-red-700',
  [ORDER_STATUS.REFUNDED]: 'bg-red-100 text-red-800',
};

const STATUSES = Object.values(ORDER_STATUS).map((value) => ({
  value,
  label: ORDER_STATUS_LABELS[value],
  color: STATUS_COLORS[value] || 'bg-muted text-muted-foreground',
}));

function getPartnerNext(status) {
  const n = normalizeOrderStatus(status);
  const step = MERCHANT_STATUS_FLOW[n];
  if (!step) return null;
  return { status: step.next, label: step.label };
}

const PAYMENT_LABELS = {
  ecocash: 'EcoCash', onemoney: 'OneMoney', innbucks: 'InnBucks', cash_on_delivery: 'Cash on Delivery',
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

function buildPackProgress(items = []) {
  const totalUnits = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const packedUnits = items.reduce((sum, item) => sum + (item.packed_quantity || 0), 0);
  return { packed_units: packedUnits, total_units: totalUnits };
}

export default function PartnerOrders({ shop }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('active');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['partner-orders', shop?.id],
    queryFn: () => base44.entities.Order.filter({ shop_id: shop.id }, '-created_date', 100),
    enabled: !!shop?.id,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['partner-menu-items-for-replacements', shop?.id],
    queryFn: () => base44.entities.MenuItem.filter({ shop_id: shop.id }, 'name', 200),
    enabled: !!shop?.id,
  });

  const filtered = filter === 'active'
    ? orders.filter(o => !isTerminalOrderStatus(o.status))
    : filter === 'all' ? orders
    : orders.filter(o => normalizeOrderStatus(o.status) === normalizeOrderStatus(filter));

  // Alert sound — plays while there are unconfirmed pending orders
  const unconfirmedCount = orders.filter(o => normalizeOrderStatus(o.status) === ORDER_STATUS.PENDING_ACCEPTANCE).length;
  const { playing: alertPlaying, silence: silenceAlert } = useOrderAlertSound(unconfirmedCount > 0);

  const advance = async (order) => {
    const next = getPartnerNext(order.status);
    if (!next) return;
    try {
      await base44.entities.Order.update(order.id, { status: next.status });
      toast.success(`Order marked as: ${next.label.replace('Mark ', '')}`);
      qc.invalidateQueries({ queryKey: ['partner-orders', shop?.id] });
    } catch (err) {
      toast.error(err?.message || 'Could not update order. Please try again.');
      qc.invalidateQueries({ queryKey: ['partner-orders', shop?.id] });
    }
  };

  const cancel = async (order) => {
    if (!confirm('Cancel this order?')) return;
    try {
      const walletRefund = parseFloat(order.wallet_applied || 0);
      if (walletRefund > 0 && order.customer_email) {
        await refundToCustomerWallet(
          order.customer_email,
          walletRefund,
          `Refund — cancelled order from ${shop?.name || order.shop_name || 'merchant'}`
        );
      }
      await base44.entities.Order.update(order.id, {
        status: ORDER_STATUS.CANCELLED,
        cancel_reason: 'merchant',
      });
      qc.invalidateQueries({ queryKey: ['partner-orders', shop?.id] });
      toast.success(
        walletRefund > 0
          ? `Order cancelled — $${walletRefund.toFixed(2)} refunded to customer wallet`
          : 'Order cancelled'
      );
    } catch (err) {
      toast.error(err?.message || 'Could not cancel order. Please try again.');
      qc.invalidateQueries({ queryKey: ['partner-orders', shop?.id] });
    }
  };

  const updatePackedQty = async (order, item, delta) => {
    const items = normalizeItems(order.items);
    const itemIndex = items.findIndex(i => i.menu_item_id === item.menu_item_id);
    if (itemIndex < 0) return;
    const current = items[itemIndex];
    const nextPacked = Math.max(0, Math.min(current.quantity || 0, (current.packed_quantity || 0) + delta));
    items[itemIndex] = { ...current, packed_quantity: nextPacked };

    await base44.entities.Order.update(order.id, {
      items,
      pack_progress: buildPackProgress(items),
    });
    qc.invalidateQueries({ queryKey: ['partner-orders', shop?.id] });
  };

  const markUnavailable = async (order, item) => {
    if (!confirm(`Mark "${item.name}" as out of stock and ask customer for a replacement?`)) return;

    const items = normalizeItems(order.items);
    const itemIndex = items.findIndex(i => i.menu_item_id === item.menu_item_id);
    if (itemIndex < 0) return;

    const alternatives = menuItems
      .filter(m =>
        m.is_available !== false &&
        m.id !== item.menu_item_id &&
        (m.category === item.category || m.price <= item.price)
      )
      .slice(0, 3)
      .map(m => ({
        id: m.id,
        name: m.name,
        price: m.price,
        category: m.category || '',
      }));

    const request = {
      id: `${Date.now().toString(36)}_${item.menu_item_id}`,
      item_menu_id: item.menu_item_id,
      item_name: item.name,
      original_price: item.price,
      quantity: item.quantity,
      options: alternatives,
      status: 'pending',
      created_date: new Date().toISOString(),
    };

    items[itemIndex] = {
      ...items[itemIndex],
      unavailable: true,
      replacement_pending: true,
      replacement_options: alternatives,
    };

    const existingRequests = Array.isArray(order.adjustment_requests) ? order.adjustment_requests : [];
    const filteredRequests = existingRequests.filter(r => r.item_menu_id !== item.menu_item_id || r.status === 'resolved');

    await base44.entities.Order.update(order.id, {
      items,
      adjustment_requests: [...filteredRequests, request],
      pack_progress: buildPackProgress(items),
    });

    notifyReplacementNeeded(order, item.name);
    toast.success(`Customer notified: choose replacement for "${item.name}"`);
    qc.invalidateQueries({ queryKey: ['partner-orders', shop?.id] });
  };

  const si = (s) => STATUSES.find(x => x.value === normalizeOrderStatus(s)) || STATUSES[0];

  if (isLoading) return <div className="animate-pulse space-y-3">{[1,2,3].map(i=><div key={i} className="h-32 bg-muted rounded-2xl"/>)}</div>;

  return (
    <div>
      {/* Alert banner when there are unconfirmed orders */}
      {unconfirmedCount > 0 && (
        <div className="sticky top-0 z-30 bg-red-600 text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="animate-pulse text-lg">🔔</span>
            <p className="font-bold text-sm">
              {unconfirmedCount} new order{unconfirmedCount > 1 ? 's' : ''} waiting for confirmation!
            </p>
          </div>
          {alertPlaying && (
            <button onClick={silenceAlert}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full font-semibold">
              Silence
            </button>
          )}
        </div>
      )}
      <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground text-sm">{orders.length} total</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active Orders</SelectItem>
            <SelectItem value="all">All Orders</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <div className="bg-card rounded-2xl border border-border p-12 text-center">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-semibold text-foreground">No orders found</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(order => {
          const info = si(order.status);
          const next = getPartnerNext(order.status);
          const normalizedItems = normalizeItems(order.items);
          const packProgress = order.pack_progress || buildPackProgress(normalizedItems);
          const pendingRequests = (order.adjustment_requests || []).filter(r => r.status === 'pending').length;
          return (
            <div key={order.id} className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-foreground text-sm">{order.customer_name || 'Customer'}</p>
                    <Badge className={`text-xs ${info.color}`}>{info.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(order.created_date), 'dd MMM, HH:mm')} · {order.is_pickup ? '🏪 Pickup' : PAYMENT_LABELS[order.payment_method] || order.payment_method}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground">${order.partner_payout?.toFixed(2) ?? order.total?.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">your payout</p>
                </div>
              </div>

              <div className="px-4 py-2 border-b border-border bg-muted/20 flex items-center justify-between gap-2">
                <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-primary" />
                  Packing progress: {packProgress.packed_units}/{packProgress.total_units} packed
                </div>
                {pendingRequests > 0 && (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold">
                    {pendingRequests} waiting customer choice
                  </span>
                )}
              </div>

              <div className="p-4 space-y-1">
                {normalizedItems.map((item, i) => (
                  <div key={i} className={`flex justify-between items-center text-sm ${item.unavailable && !item.replacement_pending ? 'opacity-40 line-through' : ''}`}>
                    <span className="text-foreground">
                      {item.quantity}× {item.name}
                      {item.replacement_pending && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">
                          waiting customer
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 border border-border rounded-lg px-1 py-0.5">
                        <button
                          onClick={() => updatePackedQty(order, item, -1)}
                          disabled={![ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING].includes(normalizeOrderStatus(order.status))}
                          className="w-5 h-5 rounded bg-muted hover:bg-muted/70 disabled:opacity-50 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-semibold min-w-10 text-center">
                          {item.packed_quantity || 0}/{item.quantity}
                        </span>
                        <button
                          onClick={() => updatePackedQty(order, item, 1)}
                          disabled={![ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING].includes(normalizeOrderStatus(order.status))}
                          className="w-5 h-5 rounded bg-muted hover:bg-muted/70 disabled:opacity-50 flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-muted-foreground">${(item.price * item.quantity).toFixed(2)}</span>
                      {!item.unavailable && [ORDER_STATUS.PENDING_ACCEPTANCE, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING].includes(normalizeOrderStatus(order.status)) && (
                        <button onClick={() => markUnavailable(order, item)}
                          className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-lg hover:bg-red-100">
                          Out of stock
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {order.delivery_address && (
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                    📍 {order.delivery_address}, {order.delivery_city}
                    {order.distance_km && <span className="ml-1">({order.distance_km.toFixed(1)} km)</span>}
                  </p>
                )}
                {order.delivery_notes && <p className="text-xs text-muted-foreground">💬 {order.delivery_notes}</p>}
              </div>

              {!isTerminalOrderStatus(order.status) && (
                <div className="px-4 pb-4 flex gap-2">
                  {next && (
                    <button onClick={() => advance(order)}
                      className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-2 rounded-xl hover:bg-primary/90 transition-colors">
                      {next.label}
                    </button>
                  )}
                  {[ORDER_STATUS.PENDING_ACCEPTANCE, ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING].includes(normalizeOrderStatus(order.status)) && (
                    <button onClick={() => cancel(order)}
                      className="px-4 bg-destructive/10 text-destructive text-xs font-semibold py-2 rounded-xl hover:bg-destructive/20 transition-colors">
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
}

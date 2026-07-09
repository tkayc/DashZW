import React, { useState } from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, ChevronRight, Store, ReceiptText, RotateCcw,
  Star, LifeBuoy, FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useCart } from '@/lib/CartContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  normalizeOrderStatus,
  isActiveOrderStatus,
} from '@/domain/orderStates';

const statusColors = {
  [ORDER_STATUS.PENDING_ACCEPTANCE]: 'bg-secondary text-secondary-foreground',
  [ORDER_STATUS.ACCEPTED]: 'bg-primary/15 text-primary',
  [ORDER_STATUS.PREPARING]: 'bg-accent/15 text-accent',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'bg-accent/15 text-accent',
  [ORDER_STATUS.DRIVER_ASSIGNED]: 'bg-primary/15 text-primary',
  [ORDER_STATUS.PICKED_UP]: 'bg-primary/15 text-primary',
  [ORDER_STATUS.IN_TRANSIT]: 'bg-primary/15 text-primary',
  [ORDER_STATUS.DELIVERED]: 'bg-green-100 text-green-700',
  [ORDER_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
  [ORDER_STATUS.CANCELLED]: 'bg-destructive/15 text-destructive',
  [ORDER_STATUS.REFUNDED]: 'bg-destructive/15 text-destructive',
};

const statusLabel = (s) => ORDER_STATUS_LABELS[normalizeOrderStatus(s)] || s?.replace(/_/g, ' ');

const FILTERS = [
  { id: 'current', label: 'Current' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'refunded', label: 'Refunded' },
];

/**
 * Order history — current / past / cancelled / refunded,
 * receipts, reorder, rate merchant/driver, support ticket, invoices placeholder.
 */
export default function Orders() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('current');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['myOrders', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user?.email }, '-created_date', 50),
    enabled: !!user?.email,
  });

  const filtered = orders.filter((o) => {
    const s = normalizeOrderStatus(o.status);
    if (filter === 'current') return isActiveOrderStatus(s);
    if (filter === 'past') return s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.COMPLETED;
    if (filter === 'cancelled') return s === ORDER_STATUS.CANCELLED;
    if (filter === 'refunded') return s === ORDER_STATUS.REFUNDED;
    return true;
  });

  const handleReorder = (e, order) => {
    e.preventDefault();
    e.stopPropagation();
    order.items?.forEach((item) => {
      for (let i = 0; i < (item.quantity || 1); i++) {
        addItem(
          {
            menu_item_id: item.menu_item_id,
            name: item.name,
            price: item.price,
            image_url: item.image_url,
            variant_id: item.variant_id,
            variant_name: item.variant_name,
            addon_ids: item.addon_ids,
            addon_names: item.addon_names,
          },
          { id: order.shop_id || order.merchant_id, name: order.shop_name || order.merchant_name, delivery_fee: order.delivery_fee }
        );
      }
    });
    toast.success(`${order.items?.length || 0} item(s) added to cart`);
    navigate('/cart');
  };

  const openReceipt = (e, order) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/order/${order.id}`);
    toast.message('Receipt on order detail');
  };

  const invoicePlaceholder = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toast.message('Invoices coming soon');
    // TODO(backend): PDF invoices
  };

  const supportTicket = (e, order) => {
    e.preventDefault();
    e.stopPropagation();
    navigate('/help');
    toast.message(`Support ticket for #${order.id?.slice(-6)} — use Help`);
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <h1 className="text-2xl font-bold text-foreground mb-5">My Orders</h1>

      <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              filter === f.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground">No {filter} orders</p>
          <Link to="/explore">
            <Button className="mt-4 rounded-xl">Browse merchants</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const s = normalizeOrderStatus(order.status);
            const done = s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.COMPLETED;
            return (
              <Link
                key={order.id}
                to={`/order/${order.id}`}
                className="block bg-card rounded-2xl border border-border/50 p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="font-semibold text-sm truncate">
                        {order.order_kind === 'courier'
                          ? `Courier · ${(order.required_vehicle_type || 'package').replace(/_/g, ' ')}`
                          : (order.merchant_name || order.shop_name)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      #{order.id?.slice(-8)} ·{' '}
                      {order.created_date
                        ? format(new Date(order.created_date), 'dd MMM yyyy, HH:mm')
                        : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.order_kind === 'courier'
                        ? `${order.package_description || order.special_notes || 'Package'} · ${formatUSD(order.total || 0)}`
                        : `${order.items?.length || 0} items · ${formatUSD((order.total || 0))}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge className={`text-[10px] ${statusColors[s] || ''}`}>
                      {statusLabel(s)}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3" onClick={(e) => e.preventDefault()}>
                  <button
                    type="button"
                    onClick={(e) => handleReorder(e, order)}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-primary/10 text-primary"
                  >
                    <RotateCcw className="w-3 h-3" /> Reorder
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openReceipt(e, order)}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-muted text-muted-foreground"
                  >
                    <ReceiptText className="w-3 h-3" /> Receipt
                  </button>
                  <button
                    type="button"
                    onClick={invoicePlaceholder}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-muted text-muted-foreground"
                  >
                    <FileText className="w-3 h-3" /> Invoice
                  </button>
                  {done && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/order/${order.id}?rate=merchant`);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-amber-50 text-amber-800"
                      >
                        <Star className="w-3 h-3" /> Rate merchant
                      </button>
                      {order.driver_name && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(`/order/${order.id}?rate=driver`);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-amber-50 text-amber-800"
                        >
                          <Star className="w-3 h-3" /> Rate driver
                        </button>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => supportTicket(e, order)}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-muted text-muted-foreground"
                  >
                    <LifeBuoy className="w-3 h-3" /> Support
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

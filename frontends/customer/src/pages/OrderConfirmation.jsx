import React from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Package, MapPin, Clock } from 'lucide-react';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { Button } from '@/components/ui/button';
import { ORDER_STATUS_LABELS, normalizeOrderStatus } from '@/domain/orderStates';

/**
 * Post-checkout confirmation screen.
 */
export default function OrderConfirmation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-confirm', id],
    queryFn: async () => (await base44.entities.Order.filter({ id }))[0],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="px-4 pt-16 text-center">
        <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-4 pt-16 text-center space-y-4">
        <p className="text-4xl">🧾</p>
        <p className="font-semibold text-foreground">Order not found</p>
        <p className="text-sm text-muted-foreground">We couldn't load this order. It may still be processing.</p>
        <Button className="rounded-2xl" onClick={() => navigate('/orders')}>View all orders</Button>
      </div>
    );
  }

  const status = normalizeOrderStatus(order.status);

  return (
    <div className="px-4 pt-10 pb-8 text-center space-y-5 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-9 h-9 text-green-600" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Order confirmed</h1>
        <p className="text-sm text-muted-foreground mt-1">
          #{order.id?.slice(-8)} · {ORDER_STATUS_LABELS[status] || status}
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-4 text-left space-y-3">
        <div className="flex items-start gap-2 text-sm">
          <Package className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{order.merchant_name || order.shop_name}</p>
            <p className="text-xs text-muted-foreground">
              {order.items?.length || 0} item(s)
              {order.wallet_applied > 0
                ? ` · ${formatUSD(order.wallet_applied)} wallet credit · ${formatUSD(order.total || 0)} due`
                : ` · ${formatUSD(order.total || 0)}`}
            </p>
          </div>
        </div>
        {!order.is_pickup && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-muted-foreground">{order.delivery_address}</p>
          </div>
        )}
        {order.estimated_arrival_mins != null && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-muted-foreground">
              Est. arrival ~{order.estimated_arrival_mins} min
              {order.is_scheduled && order.scheduled_time
                ? ` · Scheduled ${new Date(order.scheduled_time).toLocaleString()}`
                : ''}
            </p>
          </div>
        )}
        {order.delivery_code && (
          <div className="bg-primary/10 rounded-xl p-3 text-center">
            <p className="text-xs text-muted-foreground">Delivery OTP</p>
            <p className="text-2xl font-bold tracking-widest text-primary">{order.delivery_code}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button className="w-full h-11 rounded-2xl" onClick={() => navigate(`/order/${order.id}`)}>
          Track order
        </Button>
        <Link to="/orders">
          <Button variant="outline" className="w-full h-11 rounded-2xl">View all orders</Button>
        </Link>
        <Link to="/">
          <Button variant="ghost" className="w-full">Back to home</Button>
        </Link>
      </div>
    </div>
  );
}

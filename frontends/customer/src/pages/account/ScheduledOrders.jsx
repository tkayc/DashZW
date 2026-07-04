import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { format } from 'date-fns';

/**
 * Lists orders placed with scheduled_time (already supported in Checkout).
 *
 * TODO(postgresql): Index orders(is_scheduled, scheduled_time) for efficient queries.
 * TODO(backend): Job to release scheduled orders to merchants at the right time.
 */
export default function ScheduledOrders() {
  const { user } = useAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['scheduled-orders', user?.email],
    queryFn: async () => {
      const all = await base44.entities.Order.filter({ customer_email: user.email }, '-created_date', 50);
      return all.filter((o) => o.is_scheduled && o.scheduled_time);
    },
    enabled: !!user?.email,
  });

  const upcoming = orders.filter((o) => new Date(o.scheduled_time) > new Date());
  const past = orders.filter((o) => new Date(o.scheduled_time) <= new Date());

  return (
    <div className="px-4 pt-6 pb-8">
      <PageHeader title="Scheduled orders" subtitle="Orders you planned ahead" />

      <div className="bg-card rounded-2xl border border-border/50 p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground flex-1">
            Schedule from checkout when placing an order. Merchants receive the order closer to your chosen time.
          </p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && upcoming.length === 0 && past.length === 0 && (
        <div className="bg-muted/40 rounded-2xl p-8 text-center">
          <p className="font-semibold text-foreground mb-1">No scheduled orders</p>
          <p className="text-xs text-muted-foreground mb-4">Pick a time at checkout to plan ahead.</p>
          <Link to="/" className="text-sm font-semibold text-primary">
            Browse merchants
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upcoming</p>
          <div className="space-y-2">
            {upcoming.map((o) => (
              <Link
                key={o.id}
                to={`/order/${o.id}`}
                className="block bg-card rounded-2xl border border-border/50 p-4 hover:bg-muted/30 transition-colors"
              >
                <p className="font-semibold text-sm text-foreground">{o.merchant_name || o.shop_name}</p>
                <p className="text-xs text-primary font-medium mt-1">
                  {format(new Date(o.scheduled_time), 'EEE d MMM · HH:mm')}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                  {(o.status || '').replace(/_/g, ' ')} · R{o.total?.toFixed(2)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Past scheduled</p>
          <div className="space-y-2 opacity-80">
            {past.map((o) => (
              <Link
                key={o.id}
                to={`/order/${o.id}`}
                className="block bg-card rounded-2xl border border-border/50 p-4"
              >
                <p className="font-semibold text-sm text-foreground">{o.merchant_name || o.shop_name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(o.scheduled_time), 'EEE d MMM · HH:mm')}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

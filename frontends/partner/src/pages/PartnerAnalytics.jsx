import React, { useMemo } from 'react';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { BarChart3, Download, Users, ShoppingBag, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ORDER_STATUS,
  normalizeOrderStatus,
  isTerminalOrderStatus,
} from '@/domain/orderStates';

/**
 * Merchant analytics — sales, revenue, orders, top products, customers,
 * peak hours, reports, exports, settlement history, performance charts.
 */
export default function PartnerAnalytics({ shop }) {
  const { data: orders = [] } = useQuery({
    queryKey: ['partner-analytics-orders', shop?.id],
    queryFn: () => base44.entities.Order.filter({ shop_id: shop.id }, '-created_date', 200),
    enabled: !!shop?.id,
  });

  const stats = useMemo(() => {
    const completed = orders.filter((o) => {
      const s = normalizeOrderStatus(o.status);
      return s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.COMPLETED;
    });
    const revenue = completed.reduce((s, o) => s + (o.partner_payout || o.partner_subtotal || 0), 0);
    const sales = completed.reduce((s, o) => s + (o.total || 0), 0);
    const customers = new Set(completed.map((o) => o.customer_email)).size;

    const productCounts = {};
    completed.forEach((o) => {
      (o.items || []).forEach((item) => {
        if (item.unavailable) return;
        productCounts[item.name] = (productCounts[item.name] || 0) + (item.quantity || 1);
      });
    });
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const hours = Array(24).fill(0);
    orders.forEach((o) => {
      const h = new Date(o.created_date).getHours();
      hours[h] += 1;
    });
    const peakHour = hours.indexOf(Math.max(...hours));

    return {
      revenue,
      sales,
      orderCount: orders.length,
      completed: completed.length,
      active: orders.filter((o) => !isTerminalOrderStatus(o.status)).length,
      customers,
      topProducts,
      hours,
      peakHour,
    };
  }, [orders]);

  const maxHour = Math.max(...stats.hours, 1);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">{shop?.name}</p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={() => toast.message('Exports coming soon')}
        >
          <Download className="w-4 h-4 mr-2" /> Export
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Revenue', value: `R${stats.revenue.toFixed(2)}`, icon: DollarSign },
          { label: 'Sales (GMV)', value: `R${stats.sales.toFixed(2)}`, icon: ShoppingBag },
          { label: 'Orders', value: stats.orderCount, icon: BarChart3 },
          { label: 'Customers', value: stats.customers, icon: Users },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-4">
            <s.icon className="w-4 h-4 text-primary mb-2" />
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="font-semibold text-sm mb-3">Peak hours</p>
        <div className="flex items-end gap-0.5 h-24">
          {stats.hours.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t ${i === stats.peakHour ? 'bg-primary' : 'bg-primary/40'}`}
              style={{ height: `${(h / maxHour) * 100}%`, minHeight: h ? 4 : 1 }}
              title={`${i}:00 — ${h} orders`}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Peak around {stats.peakHour}:00 · Performance chart (mock scale)
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="font-semibold text-sm mb-3">Top products</p>
        {stats.topProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed sales yet</p>
        ) : (
          <div className="space-y-2">
            {stats.topProducts.map(([name, qty], i) => (
              <div key={name} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{i + 1}. {name}</span>
                <span className="font-semibold">{qty} sold</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="font-semibold text-sm mb-1">Customer analytics</p>
        <p className="text-sm text-muted-foreground">
          {stats.customers} unique customers · {stats.completed} completed orders · {stats.active} active
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-dashed border-border p-4">
        <p className="font-semibold text-sm mb-1">Settlement history & reports</p>
        <p className="text-xs text-muted-foreground">
          Settlement ledger and scheduled reports are placeholders. Use Earnings for wallet balance.
        </p>
        {/* TODO(payments): settlement reports · TODO(exports): CSV/PDF */}
      </div>
    </div>
  );
}

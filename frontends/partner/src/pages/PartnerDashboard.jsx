import { formatUSD } from '@/lib/formatCurrency';
import React from 'react';
import { Link } from 'react-router-dom';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { ClipboardList, UtensilsCrossed, TrendingUp, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  normalizeOrderStatus,
  isActiveOrderStatus,
} from '@/domain/orderStates';

const statusColors = {
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

export default function PartnerDashboard({ shop }) {
  const { data: orders = [] } = useQuery({
    queryKey: ['partner-orders', shop?.id],
    queryFn: () => base44.entities.Order.filter({ shop_id: shop.id }, '-created_date', 50),
    enabled: !!shop?.id,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['partner-menu', shop?.id],
    queryFn: () => base44.entities.MenuItem.filter({ shop_id: shop.id }),
    enabled: !!shop?.id,
  });

  const active = orders.filter((o) => isActiveOrderStatus(o.status));
  const todayRevenue = orders
    .filter((o) => {
      const d = new Date(o.created_date);
      const now = new Date();
      const status = normalizeOrderStatus(o.status);
      // Revenue = orders actually fulfilled today (delivered/completed), not
      // in-progress ones.
      return (
        d.toDateString() === now.toDateString() &&
        [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED].includes(status)
      );
    })
    .reduce((s, o) => s + (o.total || 0), 0);

  const stats = [
    { label: 'Active Orders', value: active.length, icon: Clock, color: 'text-orange-500 bg-orange-50' },
    { label: "Today's Revenue", value: `${formatUSD(todayRevenue.toFixed(2))}`, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Total Orders', value: orders.length, icon: ClipboardList, color: 'text-blue-500 bg-blue-50' },
    { label: 'Menu Items', value: menuItems.length, icon: UtensilsCrossed, color: 'text-purple-500 bg-purple-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome back 👋</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{shop?.name} · {shop?.city}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { to: '/orders', label: 'Pending orders' },
          { to: '/inventory', label: 'Inventory' },
          { to: '/analytics', label: 'Sales & analytics' },
          { to: '/staff', label: 'Staff' },
          { to: '/branches', label: 'Branches' },
          { to: '/reviews', label: 'Reviews' },
          { to: '/notifications', label: 'Notifications' },
          { to: '/shop', label: 'Business profile' },
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="bg-card border border-border rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/40"
          >
            {l.label}
          </Link>
        ))}
      </div>

      {/* Active Orders */}
      <div className="bg-card rounded-2xl border border-border">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground">Pending / Active Orders</h2>
          <Link to="/orders" className="text-primary text-xs font-semibold flex items-center gap-0.5">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {active.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No active orders right now
          </div>
        ) : (
          <div className="divide-y divide-border">
            {active.slice(0, 5).map(order => (
              <Link key={order.id} to="/orders" className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-semibold text-sm text-foreground">{order.customer_name || order.customer_email}</p>
                  <p className="text-xs text-muted-foreground">{order.items?.length} item(s) · ${order.total?.toFixed(2)}</p>
                </div>
                <Badge className={`text-xs ${statusColors[normalizeOrderStatus(order.status)] || ''}`}>
                  {ORDER_STATUS_LABELS[normalizeOrderStatus(order.status)] || order.status}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
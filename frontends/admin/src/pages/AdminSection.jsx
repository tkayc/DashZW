import React, { useMemo } from 'react';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { getCollectionSync } from '@/api';
import { Badge } from '@/components/ui/badge';
import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  normalizeOrderStatus,
} from '@/domain/orderStates';
import { ROLES, ROLE_LABELS } from '@/domain';

/**
 * Enterprise admin section views (mock/local data).
 */
export default function AdminSection({ section }) {
  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-all'],
    queryFn: () => base44.auth.listUsers(),
  });

  const { data: shops = [] } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: () => base44.entities.Shop.filter({}, '-created_date', 200),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['admin-orders-section'],
    queryFn: () => base44.entities.Order.filter({}, '-created_date', 200),
  });

  const notifications = getCollectionSync('Notification') || [];
  const incidents = getCollectionSync('DriverIncident') || [];

  const customers = users.filter((u) => (u.role || 'customer') === 'customer');
  const drivers = users.filter((u) => u.role === 'driver');
  const partners = users.filter((u) => u.role === 'partner' || u.role === 'merchant_owner');

  const refunded = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.REFUNDED);
  const cancelled = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.CANCELLED);

  const content = useMemo(() => {
    switch (section) {
      case 'customers':
        return { title: 'Customers', rows: customers.map((u) => ({ title: u.full_name || u.email, meta: u.email })) };
      case 'drivers':
        return { title: 'Drivers', rows: drivers.map((u) => ({ title: u.full_name || u.email, meta: u.email })) };
      case 'merchants':
        return {
          title: 'Merchants',
          rows: shops.map((s) => ({
            title: s.name,
            meta: `${s.category || 'merchant'} · ${s.owner_email}`,
            badge: s.is_approved === false ? 'pending' : 'active',
          })),
        };
      case 'orders':
        return {
          title: 'Orders',
          rows: orders.slice(0, 50).map((o) => ({
            title: `#${o.id?.slice(-8)} · ${o.shop_name || o.merchant_name}`,
            meta: `${o.customer_email} · R${(o.total || 0).toFixed(2)}`,
            badge: ORDER_STATUS_LABELS[normalizeOrderStatus(o.status)] || o.status,
          })),
        };
      case 'support':
        return {
          title: 'Support',
          rows: [
            ...incidents.map((i) => ({ title: `Incident: ${i.type}`, meta: i.description, badge: i.status })),
            { title: 'Support tickets', meta: 'Ticket system placeholder', badge: 'soon' },
          ],
        };
      case 'refunds':
        return {
          title: 'Refunds',
          rows: refunded.length
            ? refunded.map((o) => ({ title: `#${o.id?.slice(-8)}`, meta: `R${(o.total || 0).toFixed(2)}`, badge: 'refunded' }))
            : [{ title: 'No refunded orders', meta: 'Refunds appear here when processed' }],
        };
      case 'disputes':
        return {
          title: 'Disputes',
          rows: [
            { title: 'No open disputes', meta: 'Dispute workflow placeholder', badge: 'soon' },
            ...cancelled.slice(0, 5).map((o) => ({
              title: `Cancelled #${o.id?.slice(-8)}`,
              meta: o.cancel_reason || 'cancelled',
              badge: 'review',
            })),
          ],
        };
      case 'reports':
        return {
          title: 'Reports',
          rows: [
            { title: 'Daily GMV', meta: `R${orders.reduce((s, o) => s + (o.total || 0), 0).toFixed(2)} (sample)` },
            { title: 'Merchant count', meta: String(shops.length) },
            { title: 'Driver count', meta: String(drivers.length) },
            { title: 'Export reports', meta: 'CSV/PDF export placeholder', badge: 'soon' },
          ],
        };
      case 'analytics':
        return {
          title: 'Platform analytics',
          rows: [
            { title: 'Orders', meta: String(orders.length) },
            { title: 'Customers', meta: String(customers.length) },
            { title: 'Merchants', meta: String(shops.length) },
            { title: 'Drivers', meta: String(drivers.length) },
          ],
        };
      case 'commissions':
        return {
          title: 'Commissions',
          rows: [
            { title: 'Platform fee', meta: '5% default (see finance service)' },
            { title: 'Partner payout', meta: 'Order partner_payout field' },
            { title: 'Driver earning', meta: 'Order driver_earning field' },
          ],
        };
      case 'settlements':
        return {
          title: 'Settlement',
          rows: [
            { title: 'Settlement engine', meta: 'Use dashboard Settlements panel for actions' },
            { title: 'History', meta: 'Settlement history placeholder' },
          ],
        };
      case 'coupons':
        return {
          title: 'Coupons',
          rows: [
            { title: 'Platform promotions', meta: 'Managed on main dashboard Promotions panel' },
            { title: 'Merchant coupons', meta: 'Partner portal promotions' },
          ],
        };
      case 'notifications':
        return {
          title: 'Notifications',
          rows: notifications.slice(0, 30).map((n) => ({
            title: n.title,
            meta: `${n.recipient_email} · ${n.type || 'system'}`,
            badge: n.read ? 'read' : 'unread',
          })),
        };
      case 'audit':
        return {
          title: 'Audit logs',
          rows: [
            { title: 'Auth events', meta: 'Login/logout audit placeholder' },
            { title: 'Order status changes', meta: 'Tracked via order updates (SSE)' },
            { title: 'Admin actions', meta: 'Audit log store placeholder', badge: 'soon' },
          ],
        };
      case 'monitoring':
        return {
          title: 'Platform monitoring',
          rows: [
            { title: 'API health', meta: '/api/health · /api/v1/health' },
            { title: 'SSE clients', meta: 'Realtime event stream active' },
            { title: 'Error tracking', meta: 'Sentry/monitoring placeholder', badge: 'soon' },
            { title: 'Uptime', meta: 'Monitoring placeholder', badge: 'soon' },
          ],
        };
      case 'roles':
        return {
          title: 'Role management',
          rows: Object.values(ROLES || {}).map((r) => ({
            title: ROLE_LABELS?.[r] || r,
            meta: `Role key: ${r}`,
          })),
        };
      default:
        return { title: section, rows: [] };
    }
  }, [
    section, customers, drivers, partners, shops, orders, notifications,
    incidents, refunded, cancelled,
  ]);

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold text-foreground">{content.title}</h1>
      <div className="bg-card rounded-2xl border border-border divide-y divide-border">
        {content.rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No data</p>
        ) : (
          content.rows.map((row, i) => (
            <div key={i} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm">{row.title}</p>
                {row.meta && <p className="text-xs text-muted-foreground mt-0.5">{row.meta}</p>}
              </div>
              {row.badge && (
                <Badge variant="secondary" className="text-[10px] shrink-0">{row.badge}</Badge>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

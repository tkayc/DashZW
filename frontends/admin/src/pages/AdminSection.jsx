import { formatUSD } from '@/lib/formatCurrency';
import React, { useMemo, useState } from 'react';
import { useRealtimeQuery as useQuery } from '@/api';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  normalizeOrderStatus,
} from '@/domain/orderStates';
import { ROLES, ROLE_LABELS } from '@/domain';
import {
  getAdminPromotions,
  createAdminPromotion,
  updateAdminPromotion,
  deleteAdminPromotion,
  getSettlements,
  settlePartnerWallet,
  getSurgeConfig,
  setSurgeConfig,
  notifyShopApproved,
} from '@/api';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

/**
 * Full admin section pages — all data from API (Postgres when DATABASE_URL is set).
 */
export default function AdminSection({ section }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const { isAuthenticated } = useAuth();

  const { data: users = [], isLoading: loadingUsers, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ['admin-users-all'],
    queryFn: () => base44.auth.listUsers(),
    enabled: isAuthenticated,
    retry: 2,
  });

  const { data: shops = [], isLoading: loadingShops, error: shopsError, refetch: refetchShops } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: () => base44.entities.Shop.list('-created_date', 200),
  });

  const { data: orders = [], isLoading: loadingOrders, error: ordersError, refetch: refetchOrders } = useQuery({
    queryKey: ['admin-orders-section'],
    queryFn: () => base44.entities.Order.list('-created_date', 200),
  });

  const { data: notifications = [], isLoading: loadingNotifs, refetch: refetchNotifs } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => base44.entities.Notification.list('-created_date', 100),
  });

  const { data: incidents = [], refetch: refetchIncidents } = useQuery({
    queryKey: ['admin-incidents'],
    queryFn: () => base44.entities.DriverIncident.list('-created_date', 100),
  });

  const { data: wallets = [] } = useQuery({
    queryKey: ['admin-wallets'],
    queryFn: () => base44.entities.Wallet.list('-created_date', 200),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 200),
  });

  const { data: promos = [], refetch: refetchPromos } = useQuery({
    queryKey: ['admin-promos'],
    queryFn: () => getAdminPromotions(),
  });

  const { data: settlements = [], refetch: refetchSettlements } = useQuery({
    queryKey: ['admin-settlements'],
    queryFn: () => getSettlements(),
  });

  const { data: surge } = useQuery({
    queryKey: ['admin-surge'],
    queryFn: () => getSurgeConfig(),
  });

  const customers = users.filter((u) => (u.role || 'customer') === 'customer');
  const drivers = users.filter((u) => u.role === 'driver');
  const partners = users.filter((u) => u.role === 'partner' || u.role === 'merchant_owner');

  const refunded = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.REFUNDED);
  const cancelled = orders.filter((o) => normalizeOrderStatus(o.status) === ORDER_STATUS.CANCELLED);
  const activeOrders = orders.filter((o) => {
    const s = normalizeOrderStatus(o.status);
    return ![ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED].includes(s);
  });

  const loading = loadingUsers || loadingShops || loadingOrders;
  const error = usersError || shopsError || ordersError;

  const refreshAll = () => {
    refetchUsers();
    refetchShops();
    refetchOrders();
    refetchNotifs();
    refetchIncidents();
    refetchPromos();
    refetchSettlements();
    qc.invalidateQueries();
  };

  const approveShop = async (shop) => {
    try {
      await base44.entities.Shop.update(shop.id, { approval_status: 'approved' });
      notifyShopApproved?.(shop.owner_email, shop.name);
      toast.success(`${shop.name} approved`);
      refetchShops();
    } catch (e) {
      toast.error(e.message || 'Failed');
    }
  };

  const rejectShop = async (shop) => {
    try {
      await base44.entities.Shop.update(shop.id, { approval_status: 'rejected' });
      toast.message(`${shop.name} rejected`);
      refetchShops();
    } catch (e) {
      toast.error(e.message || 'Failed');
    }
  };

  const settlePartner = async (email) => {
    try {
      await settlePartnerWallet(email, 'Partner', 'bank', `ADM-${Date.now()}`, 'admin@dashzw.com');
      toast.success(`Settled ${email}`);
      refetchSettlements();
    } catch (e) {
      toast.error(e.message || 'Settlement failed');
    }
  };

  const toggleSurge = async () => {
    try {
      await setSurgeConfig({ ...(surge || {}), enabled: !(surge?.enabled) });
      toast.success('Surge config updated');
      qc.invalidateQueries({ queryKey: ['admin-surge'] });
    } catch (e) {
      toast.error(e.message || 'Failed');
    }
  };

  const createPromo = async () => {
    try {
      await createAdminPromotion({
        title: 'Admin promo',
        promo_type: 'platform_discount',
        coupon_code: `SAVE${Math.floor(Math.random() * 90 + 10)}`,
        discount_value: 10,
        min_order: 50,
        is_active: true,
      });
      toast.success('Promo created');
      refetchPromos();
    } catch (e) {
      toast.error(e.message || 'Failed');
    }
  };

  const match = (text) => !q.trim() || String(text || '').toLowerCase().includes(q.toLowerCase());

  const view = useMemo(() => {
    switch (section) {
      case 'customers':
        return {
          title: 'Customers',
          subtitle: `${customers.length} accounts`,
          rows: customers.filter((u) => match(u.email) || match(u.full_name)).map((u) => ({
            id: u.id || u.email,
            title: u.full_name || u.email,
            meta: u.email,
            badge: u.is_active === false ? 'inactive' : 'active',
          })),
        };
      case 'drivers':
        return {
          title: 'Drivers',
          subtitle: `${drivers.length} accounts`,
          rows: drivers.filter((u) => match(u.email) || match(u.full_name)).map((u) => ({
            id: u.id || u.email,
            title: u.full_name || u.email,
            meta: u.email,
            badge: 'driver',
          })),
        };
      case 'merchants':
        return {
          title: 'Merchants',
          subtitle: `${shops.length} merchants`,
          rows: shops.filter((s) => match(s.name) || match(s.owner_email)).map((s) => ({
            id: s.id,
            title: s.name,
            meta: `${s.category || 'merchant'} · ${s.owner_email} · ${s.city || ''}`,
            badge: s.approval_status || 'pending',
            shop: s,
          })),
          actions: true,
        };
      case 'orders':
        return {
          title: 'Orders',
          subtitle: `${orders.length} total · ${activeOrders.length} active`,
          rows: orders.filter((o) => match(o.shop_name) || match(o.customer_email) || match(o.id)).slice(0, 100).map((o) => ({
            id: o.id,
            title: `#${o.id?.slice(-8)} · ${o.shop_name || o.merchant_name || 'Merchant'}`,
            meta: `${o.customer_email} · ${formatUSD(Number(o.total || 0).toFixed(2))}`,
            badge: ORDER_STATUS_LABELS[normalizeOrderStatus(o.status)] || o.status,
          })),
        };
      case 'support':
        return {
          title: 'Support',
          subtitle: `${incidents.length} incidents`,
          rows: incidents.length
            ? incidents.map((i) => ({
              id: i.id,
              title: `${i.type} — ${i.driver_name || i.driver_email}`,
              meta: i.description || i.order_id || '',
              badge: i.status || 'open',
            }))
            : [{ id: 'empty', title: 'No open incidents', meta: 'SOS and driver reports appear here' }],
        };
      case 'refunds':
        return {
          title: 'Refunds',
          subtitle: `${refunded.length} refunded orders`,
          rows: refunded.length
            ? refunded.map((o) => ({
              id: o.id,
              title: `#${o.id?.slice(-8)}`,
              meta: `${o.customer_email} · ${formatUSD(Number(o.total || 0).toFixed(2))}`,
              badge: 'refunded',
            }))
            : [{ id: 'empty', title: 'No refunded orders yet', meta: 'Refunded orders show here' }],
        };
      case 'disputes':
        return {
          title: 'Disputes',
          subtitle: 'Cancelled orders for review',
          rows: cancelled.length
            ? cancelled.map((o) => ({
              id: o.id,
              title: `Cancelled #${o.id?.slice(-8)}`,
              meta: `${o.cancel_reason || 'cancelled'} · ${o.customer_email}`,
              badge: 'review',
            }))
            : [{ id: 'empty', title: 'No disputes', meta: 'Cancelled orders appear here for review' }],
        };
      case 'reports':
        return {
          title: 'Reports',
          subtitle: 'Platform snapshot',
          rows: [
            { id: 'gmv', title: 'GMV (all orders)', meta: `${formatUSD(orders.reduce((s, o) => s + Number(o.total || 0), 0).toFixed(2))}` },
            { id: 'merchants', title: 'Merchants', meta: String(shops.length) },
            { id: 'customers', title: 'Customers', meta: String(customers.length) },
            { id: 'drivers', title: 'Drivers', meta: String(drivers.length) },
            { id: 'active', title: 'Active orders', meta: String(activeOrders.length) },
          ],
        };
      case 'analytics':
        return {
          title: 'Analytics',
          subtitle: 'Live counts from database',
          rows: [
            { id: 'o', title: 'Orders', meta: String(orders.length) },
            { id: 'c', title: 'Customers', meta: String(customers.length) },
            { id: 'm', title: 'Merchants', meta: String(shops.length) },
            { id: 'd', title: 'Drivers', meta: String(drivers.length) },
            { id: 'w', title: 'Wallets', meta: String(wallets.length) },
            { id: 't', title: 'Transactions', meta: String(transactions.length) },
          ],
        };
      case 'commissions':
        return {
          title: 'Commissions',
          subtitle: 'Platform fee share',
          rows: [
            { id: 'rate', title: 'Platform fee rate', meta: '5% of partner subtotal (finance service)' },
            {
              id: 'earned',
              title: 'Platform earnings (orders)',
              meta: `${formatUSD(orders.reduce((s, o) => s + Number(o.platform_earning || o.platform_fee || 0), 0).toFixed(2))}`,
            },
            {
              id: 'partner',
              title: 'Partner payouts (orders)',
              meta: `${formatUSD(orders.reduce((s, o) => s + Number(o.partner_payout || o.partner_subtotal || 0), 0).toFixed(2))}`,
            },
          ],
        };
      case 'settlements':
        return {
          title: 'Settlements',
          subtitle: `${settlements.length} records · ${partners.length} partners`,
          rows: [
            ...settlements.slice(0, 30).map((s) => ({
              id: s.id,
              title: s.partner_email || s.driver_email || 'Settlement',
              meta: `${formatUSD(Number(s.amount || 0).toFixed(2))} · ${s.status || 'pending'}`,
              badge: s.status,
            })),
            ...partners.map((p) => ({
              id: `settle-${p.email}`,
              title: `Settle partner wallet`,
              meta: p.email,
              settleEmail: p.email,
            })),
          ],
        };
      case 'coupons':
        return {
          title: 'Coupons & promos',
          subtitle: `${promos.length} platform promotions`,
          rows: promos.length
            ? promos.map((p) => ({
              id: p.id,
              title: p.title,
              meta: `${p.promo_type} · ${p.coupon_code || 'no code'} · ${p.is_active ? 'active' : 'off'}`,
              badge: p.is_active ? 'active' : 'off',
              promo: p,
            }))
            : [{ id: 'empty', title: 'No promos yet', meta: 'Create one with the button above' }],
        };
      case 'notifications':
        return {
          title: 'Notifications',
          subtitle: `${notifications.length} recent`,
          rows: notifications.filter((n) => match(n.title) || match(n.recipient_email)).map((n) => ({
            id: n.id,
            title: n.title,
            meta: `${n.recipient_email} · ${n.type || n.category || 'system'}`,
            badge: n.is_read ? 'read' : 'unread',
          })),
        };
      case 'audit':
        return {
          title: 'Audit logs',
          subtitle: 'Recent order & wallet activity',
          rows: [
            ...orders.slice(0, 15).map((o) => ({
              id: `ord-${o.id}`,
              title: `Order ${o.status}`,
              meta: `#${o.id?.slice(-8)} · ${o.customer_email} · ${o.updated_date || o.created_date}`,
            })),
            ...transactions.slice(0, 15).map((t) => ({
              id: t.id,
              title: t.type || 'transaction',
              meta: `${t.owner_email} · ${formatUSD(Number(t.amount || 0).toFixed(2))} · ${t.reason || ''}`,
            })),
          ],
        };
      case 'monitoring':
        return {
          title: 'Platform monitoring',
          subtitle: 'Health & config',
          rows: [
            { id: 'api', title: 'API health', meta: 'GET /api/health' },
            { id: 'surge', title: 'Surge pricing', meta: surge?.enabled ? 'Enabled' : 'Disabled', badge: surge?.enabled ? 'on' : 'off' },
            { id: 'users', title: 'Users in DB', meta: String(users.length) },
            { id: 'shops', title: 'Merchants in DB', meta: String(shops.length) },
            { id: 'orders', title: 'Orders in DB', meta: String(orders.length) },
          ],
        };
      case 'roles':
        return {
          title: 'Role management',
          subtitle: 'Platform roles',
          rows: Object.values(ROLES || {}).map((r) => ({
            id: r,
            title: ROLE_LABELS?.[r] || r,
            meta: `Role key: ${r} · ${users.filter((u) => u.role === r || (r === 'merchant_owner' && u.role === 'partner')).length} users`,
          })),
        };
      default:
        return { title: section, rows: [] };
    }
  }, [
    section, customers, drivers, partners, shops, orders, notifications, incidents,
    refunded, cancelled, activeOrders, wallets, transactions, promos, settlements, surge, users, q,
  ]);

  if (loading && !shops.length && !users.length) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{view.title}</h1>
          {view.subtitle && <p className="text-sm text-muted-foreground">{view.subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={refreshAll}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
          {section === 'coupons' && (
            <Button size="sm" className="rounded-xl" onClick={createPromo}>New promo</Button>
          )}
          {section === 'monitoring' && (
            <Button size="sm" variant="outline" className="rounded-xl" onClick={toggleSurge}>
              Toggle surge
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-4 py-3">
          Failed to load data: {error.message || String(error)}. Check API is running and you are logged in as admin.
        </div>
      )}

      {section === 'merchants' && shops.length === 0 && !loadingShops && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl px-4 py-3">
          No merchants in the database. Run <code className="font-mono text-xs">backend/sql/002_seed_catalog.sql</code> in pgAdmin
          (connected to <strong>dashzw</strong>), then click Refresh.
        </div>
      )}

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter…"
        className="rounded-xl max-w-sm"
      />

      <div className="bg-card rounded-2xl border border-border divide-y divide-border">
        {view.rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No data</p>
        ) : (
          view.rows.map((row) => (
            <div key={row.id} className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm">{row.title}</p>
                {row.meta && <p className="text-xs text-muted-foreground mt-0.5">{row.meta}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {row.badge && (
                  <Badge variant="secondary" className="text-[10px]">{row.badge}</Badge>
                )}
                {section === 'merchants' && row.shop && row.shop.approval_status !== 'approved' && (
                  <Button size="sm" className="h-8 rounded-lg" onClick={() => approveShop(row.shop)}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                )}
                {section === 'merchants' && row.shop && row.shop.approval_status !== 'rejected' && (
                  <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => rejectShop(row.shop)}>
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                  </Button>
                )}
                {section === 'settlements' && row.settleEmail && (
                  <Button size="sm" className="h-8 rounded-lg" onClick={() => settlePartner(row.settleEmail)}>
                    Settle
                  </Button>
                )}
                {section === 'coupons' && row.promo && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg"
                    onClick={async () => {
                      try {
                        await updateAdminPromotion(row.promo.id, { is_active: !row.promo.is_active });
                        refetchPromos();
                      } catch (e) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    {row.promo.is_active ? 'Disable' : 'Enable'}
                  </Button>
                )}
                {section === 'coupons' && row.promo && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 rounded-lg text-destructive"
                    onClick={async () => {
                      try {
                        await deleteAdminPromotion(row.promo.id);
                        refetchPromos();
                      } catch (e) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

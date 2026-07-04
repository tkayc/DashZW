import React, { useState, useEffect } from 'react';
import { useRealtimeQuery as useQuery } from '@/api';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api';
import { getCollectionSync, getCollection, saveCollection } from '@/api';
import { getBalance, PLATFORM_EMAIL } from '@/api';
import {
  TrendingUp, Store, ShoppingBag, DollarSign, CheckCircle2,
  XCircle, Clock, BarChart3, AlertTriangle, Wallet, Tag,
  Phone, Mail, MapPin, Navigation, Loader2, Plus, Edit2,
  Trash2, X, ChevronDown, ChevronUp, Users
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, formatDistanceToNow } from 'date-fns';
import { notifyShopApproved } from '@/api';
import {
  getAdminPromotions, createAdminPromotion,
  updateAdminPromotion, deleteAdminPromotion
} from '@/api';
import { getSettlements, settlePartnerWallet, getCodReceivables } from '@/api';
import { getSurgeConfig, setSurgeConfig, calcSurgeMultiplier } from '@/api';
import AdminUsersPanel from './AdminUsersInline';
import { toast } from 'sonner';
import DeliveryMap from '@/components/map/DeliveryMap';

// ── helpers ───────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'bg-primary/10 text-primary' }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-primary font-medium mt-0.5">{sub}</p>}
    </div>
  );
}

const PROMO_TYPES = [
  { value: 'free_delivery',     label: '🚚 Free Delivery',        desc: 'Platform pays driver — customer pays $0 delivery' },
  { value: 'platform_discount', label: '💸 Cart Discount',        desc: 'Platform funds % or fixed discount on cart' },
  { value: 'new_user_discount', label: '🎁 New User Discount',    desc: 'First-order customers only' },
  { value: 'flash_sale',        label: '⚡ Flash Sale',            desc: 'Time-limited discount on any order' },
  { value: 'loyalty_reward',    label: '⭐ Loyalty Reward',       desc: 'Reward repeat customers' },
  { value: 'referral',          label: '👥 Referral Bonus',       desc: 'Discount for referring new users' },
];

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

// ── Late delivery alert (>45 min since picked_up/on_the_way) ─────────────────
function useLateDeliveries(orders) {
  const now = Date.now();
  return orders.filter(o => {
    if (!['picked_up','on_the_way'].includes(o.status)) return false;
    const updated = new Date(o.updated_date).getTime();
    return (now - updated) > 45 * 60 * 1000;
  });
}

// ── Late Delivery Detail Panel ────────────────────────────────────────────────
function LateOrderPanel({ order, onClose }) {
  const [showMap, setShowMap] = useState(false);
  const [users, setUsers] = useState([]);
  useEffect(() => { base44.auth.listUsers().then(setUsers); }, []);
  const driver = users.find(u => u.email === order.driver_email);
  const minLate = Math.floor((Date.now() - new Date(order.updated_date).getTime()) / 60000);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border w-full max-w-md overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-red-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <p className="font-bold text-red-800">Late Delivery — {minLate} min</p>
              <p className="text-xs text-red-600">Order #{order.id?.slice(-8)}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-100">
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Driver info */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Driver</p>
            <p className="font-bold text-foreground">{order.driver_name || order.driver_email}</p>
            {driver?.phone && (
              <a href={`tel:${driver.phone}`}
                className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                <Phone className="w-4 h-4" /> {driver.phone}
              </a>
            )}
            <a href={`mailto:${order.driver_email}`}
              className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
              <Mail className="w-4 h-4" /> {order.driver_email}
            </a>
          </div>

          {/* Order info */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shop</span>
              <span className="font-medium">{order.shop_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{order.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className="bg-orange-100 text-orange-700 text-xs">{order.status.replace(/_/g,' ')}</Badge>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{order.delivery_address}, {order.delivery_city}</span>
            </div>
          </div>

          {/* Map toggle */}
          <button onClick={() => setShowMap(v => !v)}
            className="flex items-center gap-2 text-sm text-primary font-medium">
            <Navigation className="w-4 h-4" />
            {showMap ? 'Hide Map' : 'Track Driver on Map'}
            {order.driver_lat && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
          </button>

          {showMap && (
            <DeliveryMap
              shopAddress={order.shop_address || order.shop_name}
              deliveryAddress={`${order.delivery_address}, ${order.delivery_city}`}
              driverPosition={order.driver_lat && order.driver_lng ? [order.driver_lat, order.driver_lng] : null}
            />
          )}

          {!order.driver_lat && showMap && (
            <p className="text-xs text-muted-foreground text-center">
              Driver hasn't shared GPS location yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Promo Form ────────────────────────────────────────────────────────────────
function PromoForm({ existing, onSave, onCancel }) {
  const blank = {
    title: '', promo_type: 'free_delivery', coupon_code: '',
    discount_type: 'percentage', discount_value: 10,
    min_order_amount: '', max_uses: '', new_users_only: false,
    applicable_days: [], start_date: '', end_date: '', description: '',
  };
  const [form, setForm] = useState(existing ? {
    ...blank, ...existing,
    min_order_amount: existing.min_order_amount ?? '',
    max_uses: existing.max_uses ?? '',
  } : blank);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const needsDiscountValue = form.promo_type !== 'free_delivery';
  const typeInfo = PROMO_TYPES.find(t => t.value === form.promo_type);

  const handleSave = () => {
    if (!form.title.trim()) { toast.error('Enter a title'); return; }
    if (!form.coupon_code.trim()) { toast.error('Enter a coupon code'); return; }
    if (needsDiscountValue && !form.discount_value) { toast.error('Enter a discount value'); return; }
    const data = {
      ...form,
      coupon_code: form.coupon_code.toUpperCase().trim(),
      min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      discount_value: needsDiscountValue ? parseFloat(form.discount_value) : null,
    };
    onSave(data);
  };

  const toggleDay = (day) => {
    set('applicable_days', form.applicable_days.includes(day)
      ? form.applicable_days.filter(d => d !== day)
      : [...form.applicable_days, day]);
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <h3 className="font-bold text-foreground">{existing ? 'Edit Promotion' : 'New Platform Promotion'}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Title *</Label>
          <Input placeholder="e.g. Weekend Free Delivery" value={form.title}
            onChange={e => set('title', e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Coupon Code *</Label>
          <Input placeholder="e.g. FREEDEL50" value={form.coupon_code}
            onChange={e => set('coupon_code', e.target.value.toUpperCase())}
            className="rounded-xl font-mono" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Promotion Type *</Label>
        <Select value={form.promo_type} onValueChange={v => set('promo_type', v)}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROMO_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {typeInfo && <p className="text-xs text-muted-foreground">{typeInfo.desc}</p>}
      </div>

      {needsDiscountValue && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Discount Type</Label>
            <Select value={form.discount_type} onValueChange={v => set('discount_type', v)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{form.discount_type === 'percentage' ? 'Discount %' : 'Discount $'}</Label>
            <Input type="number" min="1" max={form.discount_type === 'percentage' ? 100 : undefined}
              value={form.discount_value} onChange={e => set('discount_value', e.target.value)}
              className="rounded-xl" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Min Order ($)</Label>
          <Input type="number" min="0" placeholder="No minimum"
            value={form.min_order_amount} onChange={e => set('min_order_amount', e.target.value)}
            className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Max Uses</Label>
          <Input type="number" min="1" placeholder="Unlimited"
            value={form.max_uses} onChange={e => set('max_uses', e.target.value)}
            className="rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Start Date</Label>
          <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
            className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">End Date</Label>
          <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
            className="rounded-xl" />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Valid Days (empty = every day)</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(day => (
            <button key={day} type="button" onClick={() => toggleDay(day)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                form.applicable_days.includes(day)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}>
              {day.slice(0,3)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="newonly" checked={form.new_users_only}
          onChange={e => set('new_users_only', e.target.checked)}
          className="w-4 h-4 rounded" />
        <label htmlFor="newonly" className="text-sm text-foreground">New customers only</label>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Description (shown to customer)</Label>
        <Input placeholder="Brief description..." value={form.description}
          onChange={e => set('description', e.target.value)} className="rounded-xl" />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} className="flex-1 rounded-xl">Cancel</Button>
        <Button onClick={handleSave} className="flex-1 rounded-xl">
          {existing ? 'Save Changes' : 'Create Promotion'}
        </Button>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab]     = useState('overview');
  const [selectedLate, setSelectedLate] = useState(null);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingPromo, setEditingPromo]   = useState(null);
  const [promos, setPromos] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [settleForm, setSettleForm] = useState(null);
  const [surgeConfig, setSurgeConfigState] = useState({});
  const [currentSurge, setCurrentSurge] = useState({ active: false, multiplier: 1 });
  const [platformBalance, setPlatformBalance] = useState(0);
  const [codReceivables, setCodReceivables] = useState(0);
  const [partnerBalances, setPartnerBalances] = useState({});
  const [settleRef, setSettleRef] = useState('');
  const [settleMethod, setSettleMethod] = useState('ecocash');
  const [settling, setSettling] = useState(false);

  const { data: shops = [] } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: () => base44.entities.Shop.list('-created_date', 100),
  });
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => base44.entities.Order.list('-created_date', 500),
    refetchInterval: 30000,
  });

  useEffect(() => {
    getAdminPromotions().then(setPromos).catch(() => setPromos([]));
    getSettlements().then(setSettlements).catch(() => setSettlements([]));
    getBalance(PLATFORM_EMAIL).then(setPlatformBalance).catch(() => setPlatformBalance(0));
    getCodReceivables().then(setCodReceivables).catch(() => setCodReceivables(0));
    getSurgeConfig().then(setSurgeConfigState).catch(() => setSurgeConfigState({}));
    calcSurgeMultiplier().then(setCurrentSurge).catch(() => setCurrentSurge({ active: false, multiplier: 1 }));
  }, [activeTab]);

  const refreshPromos = () => getAdminPromotions().then(setPromos).catch(() => setPromos([]));

  const applySurgeConfig = async (next) => {
    setSurgeConfigState(next);
    try {
      await setSurgeConfig(next);
      const surge = await calcSurgeMultiplier();
      setCurrentSurge(surge);
    } catch (err) {
      toast.error(err.message || 'Failed to update surge');
    }
  };

  const txs              = getCollectionSync('Transaction').filter(t => t.owner_email === PLATFORM_EMAIL).reverse();
  const wallets          = getCollectionSync('Wallet');
  const pendingShops     = shops.filter(s => s.approval_status === 'pending');
  const approvedShops    = shops.filter(s => s.approval_status !== 'rejected');
  const deliveredOrders  = orders.filter(o => o.status === 'delivered');
  const activeOrders     = orders.filter(o => !['delivered','cancelled','completed','refunded'].includes(o.status));
  const lateDeliveries   = useLateDeliveries(orders);

  useEffect(() => {
    if (activeTab !== 'settlements') return;
    const partners = shops.filter((s) => s.approval_status !== 'rejected');
    if (!partners.length) return;
    Promise.all(
      partners.map(async (shop) => {
        const bal = await getBalance(shop.owner_email, 'partner').catch(() => 0);
        return [shop.owner_email, bal];
      })
    ).then((pairs) => setPartnerBalances(Object.fromEntries(pairs)));
  }, [activeTab, shops]);

  const totalRevenue = deliveredOrders.reduce((s, o) => s + (o.platform_earning || 0), 0);
  const todayOrders  = deliveredOrders.filter(o =>
    new Date(o.created_date).toDateString() === new Date().toDateString()
  );
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.platform_earning || 0), 0);

  const shopEarnings = approvedShops.map(shop => {
    const shopOrders = deliveredOrders.filter(o => o.shop_id === shop.id);
    const earned = shopOrders.reduce((s, o) => s + (o.platform_earning || 0), 0);
    const gmv    = shopOrders.reduce((s, o) => s + (o.customer_subtotal || o.total || 0), 0);
    return { shop, orderCount: shopOrders.length, earned, gmv };
  }).sort((a, b) => b.earned - a.earned);

  const approveShop = async (shop) => {
    await base44.entities.Shop.update(shop.id, { approval_status: 'approved' });
    notifyShopApproved(shop.owner_email, shop.name);
    qc.invalidateQueries({ queryKey: ['admin-shops'] });
    toast.success(`${shop.name} approved!`);
  };
  const rejectShop = async (shop) => {
    if (!confirm('Reject this shop?')) return;
    await base44.entities.Shop.update(shop.id, { approval_status: 'rejected' });
    qc.invalidateQueries({ queryKey: ['admin-shops'] });
    toast.success('Shop rejected.');
  };

  const handleSavePromo = async (data) => {
    try {
      if (editingPromo) {
        await updateAdminPromotion(editingPromo.id, data);
        toast.success('Promotion updated!');
      } else {
        await createAdminPromotion(data);
        toast.success('Promotion created!');
      }
      setShowPromoForm(false);
      setEditingPromo(null);
      refreshPromos();
    } catch (err) {
      toast.error(err.message || 'Failed to save promotion');
    }
  };

  const handleDeletePromo = async (promo) => {
    if (!confirm(`Delete "${promo.title}"?`)) return;
    try {
      await deleteAdminPromotion(promo.id);
      toast.success('Promotion deleted.');
      refreshPromos();
    } catch (err) {
      toast.error(err.message || 'Failed to delete promotion');
    }
  };

  const handleSettle = async () => {
    if (!settleRef.trim()) { toast.error('Enter a payment reference'); return; }
    if (!settleForm) return;
    setSettling(true);
    try {
      const ownerEmail = settleForm.shop.owner_email;
      const shopName = settleForm.shop.name;
      const paid = settleForm.balance;
      await settlePartnerWallet(ownerEmail, shopName, settleMethod, settleRef, 'admin@dashzw.com');
      toast.success(`${shopName} settled — R${paid.toFixed(2)} paid via ${settleMethod.toUpperCase()}`);
      setSettleForm(null);
      setSettleRef('');
      setSettlements(await getSettlements());
      const bal = await getBalance(ownerEmail, 'partner').catch(() => 0);
      setPartnerBalances((prev) => ({ ...prev, [ownerEmail]: bal }));
      qc.invalidateQueries({ queryKey: ['admin-wallets'] });
    } catch (err) {
      toast.error(err.message);
    } finally { setSettling(false); }
  };

  const TABS = [
    { id: 'overview',    label: 'Overview',    icon: BarChart3 },
    { id: 'late',        label: 'Late Deliveries', icon: Clock,   alert: lateDeliveries.length },
    { id: 'shops',       label: 'Shops',        icon: Store,   alert: pendingShops.length },
    { id: 'orders',      label: 'Orders',       icon: ShoppingBag },
    { id: 'promotions',  label: 'Promotions',   icon: Tag },
    { id: 'wallets',     label: 'Wallets',      icon: Wallet },
    { id: 'settlements', label: 'Settlements',  icon: DollarSign },
    { id: 'users',       label: 'Users',        icon: Users },
    { id: 'surge',       label: 'Surge Pricing', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-foreground">DashZW Manager</p>
            <p className="text-[10px] text-muted-foreground">Owner Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-xl">
          <DollarSign className="w-4 h-4" />
          <span className="font-bold text-sm">${platformBalance.toFixed(2)}</span>
          <span className="text-xs hidden sm:inline">Platform Balance</span>
        </div>
      </header>

      {/* Late delivery banner */}
      {lateDeliveries.length > 0 && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <p className="text-sm font-semibold text-red-800">
              {lateDeliveries.length} delivery{lateDeliveries.length > 1 ? 'ies' : ''} overdue (&gt;45 min)
            </p>
          </div>
          <button onClick={() => setActiveTab('late')}
            className="text-xs font-semibold text-red-700 bg-red-100 px-3 py-1 rounded-lg hover:bg-red-200 shrink-0">
            View All
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); refreshPromos(); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-muted border border-border'
            }`}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.alert > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 ${
                activeTab === tab.id ? 'bg-white/30 text-white' : 'bg-accent text-accent-foreground'
              }`}>{tab.alert}</span>
            )}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-5">

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={DollarSign}  label="Total Earnings"  value={`R${totalRevenue.toFixed(2)}`} sub={`R${todayRevenue.toFixed(2)} today`} color="bg-green-50 text-green-700" />
              <StatCard icon={Store}       label="Active Shops"    value={approvedShops.length}           sub={`${pendingShops.length} pending`}     color="bg-blue-50 text-blue-700" />
              <StatCard icon={ShoppingBag} label="Total Orders"    value={orders.length}                  sub={`${activeOrders.length} active`}      color="bg-purple-50 text-purple-700" />
              <StatCard icon={CheckCircle2}label="Delivered"       value={deliveredOrders.length}         sub={`${todayOrders.length} today`}        color="bg-primary/10 text-primary" />
            </div>

            {/* ── Admin danger zone: reset buttons ── */}
            <div className="bg-card rounded-2xl border border-red-200 p-4">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">⚠️ Data Management</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    if (!window.confirm('Reset ALL orders, wallets and transactions? Shops and menus will be kept.')) return;
                    resetOrderData();
                    qc.invalidateQueries();
                    toast.success('Orders and wallets reset. Shops and menus kept.');
                  }}
                  className="flex items-center gap-2 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-orange-100 transition-colors">
                  🗑️ Reset Orders &amp; Wallets
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm('FULL FACTORY RESET? This clears everything except user accounts. App will re-seed fresh.')) return;
                    factoryReset();
                    qc.invalidateQueries();
                    toast.success('Factory reset done. Reload the page to re-seed.');
                    setTimeout(() => window.location.reload(), 1500);
                  }}
                  className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-red-100 transition-colors">
                  🔴 Full Factory Reset
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                "Reset Orders" clears all orders, wallets, notifications and driver states — keeps shops and menus intact. "Factory Reset" wipes everything and re-seeds from scratch.
              </p>
            </div>

            {/* COD receivables explanation */}
            {codReceivables > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-orange-800">COD Receivables: ${codReceivables.toFixed(2)}</p>
                    <p className="text-xs text-orange-700 mt-1">
                      This is money drivers collected as cash on delivery that they still owe the platform.
                      It flows in when drivers do withdrawals or top-ups at partner shops.
                      Your platform wallet balance of R${platformBalance.toFixed(2)} includes COD earnings already credited digitally.
                      The actual cash arrives via driver wallet top-ups.
                    </p>
                  </div>
                </div>
              </div>
            )}


            {lateDeliveries.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 flex items-center gap-2 border-b border-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <h2 className="font-bold text-red-800">Overdue Deliveries</h2>
                </div>
                {lateDeliveries.map(order => {
                  const minLate = Math.floor((Date.now() - new Date(order.updated_date).getTime()) / 60000);
                  return (
                    <button key={order.id} onClick={() => setSelectedLate(order)}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-red-100 transition-colors border-b border-red-100 last:border-0 text-left">
                      <div>
                        <p className="font-semibold text-sm text-red-900">{order.driver_name || order.driver_email}</p>
                        <p className="text-xs text-red-700">{order.shop_name} → {order.customer_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-red-700">{minLate} min late</p>
                        <p className="text-xs text-red-600">{order.status.replace(/_/g,' ')}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="bg-card rounded-2xl border border-border">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-bold text-foreground">Revenue by Shop</h2>
              </div>
              {shopEarnings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No delivered orders yet</p>
              ) : (
                <div className="divide-y divide-border">
                  {shopEarnings.map(({ shop, orderCount, earned, gmv }) => (
                    <div key={shop.id} className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Store className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{shop.name}</p>
                          <p className="text-xs text-muted-foreground">{orderCount} orders · GMV ${gmv.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-700">${earned.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">platform earn</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {txs.length > 0 && (
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-bold text-foreground">Recent Earnings</h2>
                </div>
                <div className="divide-y divide-border">
                  {txs.slice(0, 10).map((tx, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm text-foreground">{tx.reason}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.created_date).toLocaleString()}</p>
                      </div>
                      <span className={`font-bold ${tx.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {tx.amount >= 0 ? '+' : ''}${tx.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── LATE DELIVERIES ── */}
        {activeTab === 'late' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="font-bold text-foreground">Overdue Deliveries (&gt;45 min)</h2>
            </div>

            {lateDeliveries.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-foreground">All deliveries on time</p>
                <p className="text-sm text-muted-foreground mt-1">No deliveries have exceeded 45 minutes</p>
              </div>
            ) : (
              lateDeliveries.map(order => {
                const minLate = Math.floor((Date.now() - new Date(order.updated_date).getTime()) / 60000);
                return (
                  <div key={order.id} className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-red-900">{order.driver_name || order.driver_email}</p>
                            <Badge className="bg-red-200 text-red-800 text-[10px]">{minLate} min late</Badge>
                          </div>
                          <p className="text-xs text-red-700 mt-0.5">
                            {order.shop_name} → {order.customer_name} · {order.status.replace(/_/g,' ')}
                          </p>
                        </div>
                        <p className="font-bold text-red-800 shrink-0">${order.total?.toFixed(2)}</p>
                      </div>

                      <div className="flex items-start gap-2 text-xs text-red-700">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{order.delivery_address}, {order.delivery_city}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-red-700">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span>{order.driver_email}</span>
                      </div>

                      <button onClick={() => setSelectedLate(order)}
                        className="w-full bg-red-600 text-white text-xs font-semibold py-2 rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                        <Navigation className="w-3.5 h-3.5" />
                        View Driver Details & Track
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── SHOPS ── */}
        {activeTab === 'shops' && (
          <div className="space-y-4">
            {pendingShops.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  Pending Approval ({pendingShops.length})
                </h2>
                {pendingShops.map(shop => (
                  <div key={shop.id} className="bg-card rounded-2xl border border-yellow-200 p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="font-bold text-foreground">{shop.name}</p>
                        <p className="text-xs text-muted-foreground">{shop.category} · {shop.city}</p>
                        <p className="text-xs text-muted-foreground">{shop.owner_email}</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-700 shrink-0">Pending</Badge>
                    </div>
                    {shop.address && <p className="text-xs text-muted-foreground mb-3">📍 {shop.address}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => approveShop(shop)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white text-xs font-semibold py-2 rounded-xl hover:bg-green-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => rejectShop(shop)}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-600 text-xs font-semibold py-2 rounded-xl hover:bg-red-100">
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <h2 className="font-bold text-foreground">All Shops ({shops.length})</h2>
            {shops.map(shop => {
              const shopOrders = deliveredOrders.filter(o => o.shop_id === shop.id);
              const earned = shopOrders.reduce((s, o) => s + (o.platform_earning || 0), 0);
              const status = shop.approval_status || 'approved';
              return (
                <div key={shop.id} className="bg-card rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground">{shop.name}</p>
                        <Badge className={
                          status === 'approved' ? 'bg-green-100 text-green-700' :
                          status === 'pending'  ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }>{status}</Badge>
                        <Badge className={shop.is_open ? 'bg-green-50 text-green-600 text-[10px]' : 'bg-muted text-muted-foreground text-[10px]'}>
                          {shop.is_open ? 'Open' : 'Closed'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{shop.category} · {shop.city} · {shop.owner_email}</p>
                      <p className="text-xs text-green-700 font-medium mt-1">${earned.toFixed(2)} earned · {shopOrders.length} orders</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ORDERS ── */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <h2 className="font-bold text-foreground">All Orders ({orders.length})</h2>
            {orders.slice(0, 100).map(order => {
              const isLate = lateDeliveries.some(l => l.id === order.id);
              return (
                <div key={order.id}
                  className={`bg-card rounded-2xl border p-4 ${isLate ? 'border-red-300' : 'border-border'}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-foreground">{order.shop_name}</p>
                        {isLate && <Badge className="bg-red-100 text-red-700 text-[10px]">⚠ Late</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{order.customer_name || order.customer_email}</p>
                      {order.driver_name && <p className="text-xs text-muted-foreground">Driver: {order.driver_name}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-foreground">${order.total?.toFixed(2)}</p>
                      <p className="text-xs text-green-700">+${(order.platform_earning || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={
                      order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }>{order.status?.replace(/_/g,' ')}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(order.created_date), 'dd MMM, HH:mm')}</span>
                    <span className="text-xs text-muted-foreground">{order.payment_method?.replace(/_/g,' ')}</span>
                    {isLate && (
                      <button onClick={() => setSelectedLate(order)}
                        className="text-xs text-red-600 font-medium hover:underline ml-auto">
                        Track driver →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PROMOTIONS ── */}
        {activeTab === 'promotions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-foreground">Platform Promotions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Coupons funded by the platform wallet</p>
              </div>
              {!showPromoForm && (
                <button onClick={() => { setShowPromoForm(true); setEditingPromo(null); }}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl hover:bg-primary/90">
                  <Plus className="w-3.5 h-3.5" /> New Promotion
                </button>
              )}
            </div>

            {(showPromoForm || editingPromo) && (
              <PromoForm
                existing={editingPromo}
                onSave={handleSavePromo}
                onCancel={() => { setShowPromoForm(false); setEditingPromo(null); }}
              />
            )}

            <div className="bg-muted/50 rounded-xl px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">How platform promos work</p>
              <p>• <strong>Free Delivery:</strong> Customer pays R0 delivery. Platform wallet pays the driver's earning.</p>
              <p>• <strong>Cart Discount:</strong> Platform wallet funds the discount amount. Partner still gets full payout.</p>
              <p>• Customers enter the coupon code at checkout. It applies on top of any shop promotions.</p>
            </div>

            {promos.length === 0 && !showPromoForm ? (
              <div className="bg-card rounded-2xl border border-border p-10 text-center">
                <Tag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-semibold text-foreground">No promotions yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first platform-wide coupon above</p>
              </div>
            ) : (
              <div className="space-y-3">
                {promos.map(promo => {
                  const typeInfo = PROMO_TYPES.find(t => t.value === promo.promo_type);
                  return (
                    <div key={promo.id} className={`bg-card rounded-2xl border p-4 ${promo.is_active ? 'border-border' : 'border-dashed border-muted opacity-60'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-foreground">{promo.title}</p>
                            <code className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-lg font-mono">
                              {promo.coupon_code}
                            </code>
                            <Badge className={promo.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                              {promo.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{typeInfo?.label}</p>
                          {promo.promo_type !== 'free_delivery' && promo.discount_value && (
                            <p className="text-xs text-primary font-medium mt-0.5">
                              {promo.discount_type === 'percentage' ? `${promo.discount_value}% off` : `R${promo.discount_value} off`}
                              {promo.min_order_amount ? ` · min R${promo.min_order_amount}` : ''}
                            </p>
                          )}
                          {promo.promo_type === 'free_delivery' && (
                            <p className="text-xs text-primary font-medium mt-0.5">Free delivery — platform pays driver</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                            <span>Used: {promo.times_used || 0}{promo.max_uses ? `/${promo.max_uses}` : ''} times</span>
                            {promo.start_date && <span>From {promo.start_date}</span>}
                            {promo.end_date && <span>Until {promo.end_date}</span>}
                            {promo.new_users_only && <span>New users only</span>}
                            {promo.applicable_days?.length > 0 && <span>{promo.applicable_days.join(', ')}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => {
                            updateAdminPromotion(promo.id, { is_active: !promo.is_active });
                            refreshPromos();
                            toast.success(promo.is_active ? 'Promotion deactivated' : 'Promotion activated');
                          }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground">
                            {promo.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-green-600" />}
                          </button>
                          <button onClick={() => { setEditingPromo(promo); setShowPromoForm(false); }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeletePromo(promo)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SETTLEMENTS ── */}
        {activeTab === 'settlements' && (
          <div className="space-y-5">
            <div>
              <h2 className="font-bold text-foreground">Partner Wallet Settlements</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pay out each partner's digital wallet balance via EcoCash or bank transfer, then zero their wallet.
              </p>
            </div>

            {/* Partner list with balances */}
            <div className="space-y-3">
              {approvedShops.map(shop => {
                const bal = partnerBalances[shop.owner_email] ?? 0;
                const hasPayout = shop.ecocash_number || shop.bank_account;
                return (
                  <div key={shop.id} className={`bg-card rounded-2xl border p-4 ${bal > 0 ? 'border-green-200' : 'border-border'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-foreground">{shop.name}</p>
                        <p className="text-xs text-muted-foreground">{shop.owner_email}</p>
                        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          {shop.ecocash_number && <p>📱 EcoCash: {shop.ecocash_number} ({shop.ecocash_name})</p>}
                          {shop.bank_account && <p>🏦 {shop.bank_name}: {shop.bank_account} — {shop.bank_account_name}</p>}
                          {!hasPayout && <p className="text-yellow-600">⚠ No payout details — ask partner to update their profile</p>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xl font-bold ${bal > 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                          ${bal.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">wallet balance</p>
                        {bal > 0 && (
                          <button
                            onClick={() => { setSettleForm({ shop, balance: bal }); setSettleRef(''); setSettleMethod('ecocash'); }}
                            className="mt-2 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700">
                            Settle Now
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Settlement history */}
            {settlements.length > 0 && (
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h3 className="font-semibold text-foreground">Settlement History</h3>
                </div>
                <div className="divide-y divide-border">
                  {settlements.slice(0,20).map(s => (
                    <div key={s.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{s.shop_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.method?.toUpperCase()} · Ref: {s.reference} · {new Date(s.created_date).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="font-bold text-green-700">${s.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SURGE PRICING ── */}
        {activeTab === 'surge' && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <h2 className="font-bold text-foreground text-lg">Surge Pricing Engine</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically adjust delivery fees during high demand or bad weather.
              </p>
            </div>

            {/* Current status */}
            <div className={`rounded-2xl border p-4 flex items-start gap-4 ${
              currentSurge.active ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                currentSurge.active ? 'bg-orange-100' : 'bg-green-100'
              }`}>
                <TrendingUp className={`w-5 h-5 ${currentSurge.active ? 'text-orange-600' : 'text-green-600'}`} />
              </div>
              <div>
                <p className={`font-bold ${currentSurge.active ? 'text-orange-800' : 'text-green-800'}`}>
                  {currentSurge.active ? `🔴 Surge Active — ${currentSurge.multiplier.toFixed(1)}×` : '🟢 Normal Pricing — 1.0×'}
                </p>
                <p className={`text-xs mt-0.5 ${currentSurge.active ? 'text-orange-700' : 'text-green-700'}`}>
                  {currentSurge.active ? `Reason: ${currentSurge.reason} (${currentSurge.source})` : 'No surge conditions detected right now.'}
                </p>
                {currentSurge.active && (
                  <p className="text-xs text-orange-600 mt-0.5">
                    Example: R10.00 delivery → R{(10 * currentSurge.multiplier).toFixed(2)} with surge
                  </p>
                )}
              </div>
            </div>

            {/* Manual override */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">Manual Override</p>
                <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-xl ${
                  surgeConfig.manual_surge ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'
                }`}>
                  {surgeConfig.manual_surge ? '🔴 Enabled' : '⬜ Disabled'}
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Manual Surge</p>
                  <p className="text-xs text-muted-foreground">Override auto detection (e.g. bad weather, events)</p>
                </div>
                <button onClick={() => {
                  applySurgeConfig({ ...surgeConfig, manual_surge: !surgeConfig.manual_surge });
                }} className={`w-12 h-6 rounded-full transition-colors relative ${surgeConfig.manual_surge ? 'bg-orange-500' : 'bg-muted'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${surgeConfig.manual_surge ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              {surgeConfig.manual_surge && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium">Multiplier</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min="1.1" max="2.0" step="0.1"
                        value={surgeConfig.manual_multiplier || 1.5}
                        onChange={e => {
                          applySurgeConfig({ ...surgeConfig, manual_multiplier: parseFloat(e.target.value) });
                        }}
                        className="flex-1" />
                      <span className="text-lg font-bold text-orange-600 w-12 text-right">
                        {(surgeConfig.manual_multiplier || 1.5).toFixed(1)}×
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Reason (shown to customers)</label>
                    <input
                      className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm outline-none border-0"
                      placeholder="e.g. Heavy rain, Public holiday"
                      value={surgeConfig.manual_reason || ''}
                      onChange={e => {
                        applySurgeConfig({ ...surgeConfig, manual_reason: e.target.value });
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Auto settings */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <p className="font-semibold text-foreground">Automatic Rules</p>
              {[
                { key: 'auto_time_surge', label: 'Rush hour surge', desc: 'Auto-surge during lunch (12-13h) and dinner (18-20h) when demand exceeds supply' },
                { key: 'auto_demand_surge', label: 'High demand surge', desc: `Triggers when active orders exceed threshold (currently ${surgeConfig.demand_threshold || 10})` },
              ].map(rule => (
                <div key={rule.key} className="flex items-center justify-between py-1">
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-medium text-foreground">{rule.label}</p>
                    <p className="text-xs text-muted-foreground">{rule.desc}</p>
                  </div>
                  <button onClick={() => {
                    applySurgeConfig({ ...surgeConfig, [rule.key]: surgeConfig[rule.key] === false ? true : false });
                  }} className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${surgeConfig[rule.key] === false ? 'bg-muted' : 'bg-primary'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${surgeConfig[rule.key] === false ? 'translate-x-1' : 'translate-x-7'}`} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Demand threshold (orders):</label>
                <input type="number" min="5" max="50"
                  value={surgeConfig.demand_threshold || 10}
                  onChange={e => {
                    applySurgeConfig({ ...surgeConfig, demand_threshold: parseInt(e.target.value) || 10 });
                  }}
                  className="w-20 bg-muted/50 rounded-xl px-3 py-1.5 text-sm outline-none border-0" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              ℹ️ Surge multiplier is applied to the distance-based delivery fee before the customer sees it. Max is 2.0×. Platform service fee tier is calculated on the surged fee.
            </p>
          </div>
        )}

        {/* ── USERS ── */}
        {activeTab === 'users' && <AdminUsersPanel />}

        {/* ── WALLETS ── */}
        {activeTab === 'wallets' && (
          <div className="space-y-4">
            <h2 className="font-bold text-foreground">All Wallets</h2>
            {wallets.length === 0 ? (
              <p className="text-muted-foreground text-sm">No wallets yet</p>
            ) : (
              <div className="space-y-3">
                {[...wallets].sort((a,b) => b.balance - a.balance).map(w => (
                  <div key={w.id} className={`bg-card rounded-2xl border p-4 flex items-center justify-between ${
                    w.balance < 0 ? 'border-red-200' : 'border-border'
                  }`}>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{w.owner_email}</p>
                      <Badge className={`text-[10px] mt-1 ${
                        w.owner_type === 'platform' ? 'bg-primary/10 text-primary' :
                        w.owner_type === 'driver'   ? 'bg-accent/10 text-accent' :
                        w.owner_type === 'partner'  ? 'bg-purple-100 text-purple-700' :
                        'bg-muted text-muted-foreground'
                      }`}>{w.owner_type}</Badge>
                    </div>
                    <p className={`text-lg font-bold ${w.balance < 0 ? 'text-red-700' : w.balance > 0 ? 'text-green-700' : 'text-foreground'}`}>
                      ${w.balance.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Late order detail panel */}
      {selectedLate && <LateOrderPanel order={selectedLate} onClose={() => setSelectedLate(null)} />}

      {/* Settle modal */}
      {settleForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSettleForm(null)}>
          <div className="bg-card rounded-2xl border border-border w-full max-w-sm overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="font-bold text-foreground">Settle {settleForm.shop.name}</p>
                <p className="text-xs text-muted-foreground">Pay out ${settleForm.balance.toFixed(2)} and zero wallet</p>
              </div>
              <button onClick={() => setSettleForm(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Payment details reminder */}
              <div className="bg-muted/50 rounded-xl p-3 text-xs space-y-1">
                {settleForm.shop.ecocash_number && (
                  <p>📱 <strong>EcoCash:</strong> {settleForm.shop.ecocash_number} — {settleForm.shop.ecocash_name}</p>
                )}
                {settleForm.shop.bank_account && (
                  <p>🏦 <strong>{settleForm.shop.bank_name}:</strong> {settleForm.shop.bank_account} — {settleForm.shop.bank_account_name}</p>
                )}
                {settleForm.shop.bank_branch && <p>Branch: {settleForm.shop.bank_branch}</p>}
                {!settleForm.shop.ecocash_number && !settleForm.shop.bank_account && (
                  <p className="text-yellow-600">⚠ No payout details saved. Ask partner to update their profile first.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>
                <div className="flex gap-2">
                  {['ecocash','bank'].map(m => (
                    <button key={m} onClick={() => setSettleMethod(m)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        settleMethod === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                      }`}>
                      {m === 'ecocash' ? '📱 EcoCash' : '🏦 Bank'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Transaction Reference *</Label>
                <Input placeholder="e.g. ECO-2024-98765 or bank receipt number"
                  value={settleRef} onChange={e => setSettleRef(e.target.value)}
                  className="rounded-xl" />
                <p className="text-xs text-muted-foreground">
                  Enter the reference after you've made the transfer
                </p>
              </div>

              <div className="bg-green-50 rounded-xl p-3 flex justify-between text-sm">
                <span className="font-semibold text-green-800">Amount to pay:</span>
                <span className="font-bold text-green-700">${settleForm.balance.toFixed(2)}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSettleForm(null)} className="flex-1 rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleSettle} disabled={settling || !settleRef.trim()}
                  className="flex-1 rounded-xl bg-green-600 hover:bg-green-700">
                  {settling
                    ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Processing…</>
                    : 'Confirm Settlement'
                  }
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import {
  User, Store, Bike, Shield, Search, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, KeyRound, History, X, Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getBalance, useBalance } from '@/api';
import { getCollectionSync, getCollection } from '@/api';
import { toast } from 'sonner';

const ROLE_COLORS = {
  customer: 'bg-blue-50 text-blue-700',
  partner:  'bg-purple-50 text-purple-700',
  driver:   'bg-orange-50 text-orange-700',
  admin:    'bg-primary/10 text-primary',
};
const ROLE_ICONS = { customer: User, partner: Store, driver: Bike, admin: Shield };
const ROLES = ['all','customer','partner','driver','admin'];

// ── User Detail Drawer ────────────────────────────────────────────────────────
function UserDetailDrawer({ user, onClose, onRefresh }) {
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving]           = useState(false);
  const balance = useBalance(user.email, user.role === 'admin' ? null : user.role);

  const txs = getCollectionSync('Transaction')
    .filter(t => t.owner_email === user.email)
    .sort((a,b) => new Date(b.created_date) - new Date(a.created_date));

  const orders = getCollectionSync('Order').filter(o =>
    o.customer_email === user.email ||
    o.driver_email   === user.email ||
    o.partner_email  === user.email
  ).sort((a,b) => new Date(b.created_date) - new Date(a.created_date));

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 4) {
      toast.error('Password must be at least 4 characters'); return;
    }
    setSaving(true);
    try {
      await base44.auth.updateUser(user.email, { password: newPassword });
      toast.success(`Password reset for ${user.full_name}`);
      setNewPassword('');
    } catch (e) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    const next = user.approval_status === 'suspended' ? 'approved' : 'suspended';
    await base44.auth.updateUser(user.email, { approval_status: next });
    toast.success(`${user.full_name} ${next === 'approved' ? 'reactivated' : 'suspended'}`);
    onRefresh();
    onClose();
  };

  const Icon = ROLE_ICONS[user.role] || User;
  const isSuspended = user.approval_status === 'suspended';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-border max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ROLE_COLORS[user.role]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-foreground">{user.full_name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-lg font-bold text-foreground">{orders.length}</p>
              <p className="text-[10px] text-muted-foreground">Orders</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-lg font-bold text-foreground">{txs.length}</p>
              <p className="text-[10px] text-muted-foreground">Transactions</p>
            </div>
            <div className={`rounded-xl p-3 ${balance < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className={`text-lg font-bold ${balance < 0 ? 'text-red-700' : 'text-green-700'}`}>
                {formatUSD(balance)}
              </p>
              <p className="text-[10px] text-muted-foreground">Wallet</p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Account Status</p>
              <p className="text-xs text-muted-foreground">
                Role: {user.role} · Joined {new Date(user.created_date || Date.now()).toLocaleDateString()}
              </p>
            </div>
            {user.role !== 'admin' && (
              <button onClick={toggleStatus}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                  isSuspended
                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                    : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                }`}>
                {isSuspended
                  ? <><CheckCircle2 className="w-3.5 h-3.5" />Reactivate</>
                  : <><XCircle className="w-3.5 h-3.5" />Suspend</>}
              </button>
            )}
          </div>

          {/* Reset Password */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Reset Password</p>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="New password (min 4 chars)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                className="rounded-xl flex-1"
              />
              <Button onClick={handleResetPassword}
                disabled={saving || !newPassword.trim()}
                className="rounded-xl shrink-0">
                {saving ? 'Saving…' : 'Reset'}
              </Button>
            </div>
          </div>

          {/* Transaction History */}
          {txs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Transaction History ({txs.length})</p>
              </div>
              <div className="bg-muted/30 rounded-xl overflow-hidden">
                {txs.slice(0,20).map((tx, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-xs text-foreground truncate">{tx.reason}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(tx.created_date).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${tx.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {tx.amount >= 0 ? '+R' : '-R'}{Math.abs(tx.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
                {txs.length > 20 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    {txs.length - 20} more transactions
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Recent Orders */}
          {orders.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Recent Orders ({orders.length})</p>
              <div className="bg-muted/30 rounded-xl overflow-hidden">
                {orders.slice(0,10).map((o, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0 pr-3">
                      <p className="text-xs text-foreground">{o.shop_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(o.created_date).toLocaleDateString()} · {o.status}
                      </p>
                    </div>
                    <span className="text-xs font-bold shrink-0 text-foreground">
                      {formatUSD(o.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function AdminUsersPanel() {
  const { isAuthenticated } = useAuth();
  const [balances, setBalances]   = useState({});
  const [query, setQuery]         = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);

  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch: refresh,
  } = useQuery({
    queryKey: ['admin-users-panel'],
    queryFn: () => base44.auth.listUsers(),
    enabled: isAuthenticated,
    retry: 2,
  });

  useEffect(() => {
    if (!users.length) return;
    Promise.all(
      users.map(async (u) => {
        const type = u.role === 'admin' ? null : u.role;
        const bal = await getBalance(u.email, type).catch(() => 0);
        return [u.email, bal];
      })
    ).then((pairs) => setBalances(Object.fromEntries(pairs)));
  }, [users]);

  const filtered = users.filter(u => {
    const matchRole  = roleFilter === 'all' || u.role === roleFilter;
    const matchQuery = !query ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(query.toLowerCase());
    return matchRole && matchQuery;
  });

  const getUserSummary = (u) => {
    const orders  = getCollectionSync('Order');
    const balance = balances[u.email] ?? 0;
    const count   = orders.filter(o =>
      o.customer_email === u.email || o.driver_email === u.email || o.partner_email === u.email
    ).length;
    return { count, balance };
  };

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading users…
        </div>
      )}

      {isError && (
        <div className="bg-card rounded-2xl border border-destructive/30 p-6 text-center space-y-2">
          <p className="font-semibold text-foreground">Could not load users</p>
          <p className="text-sm text-muted-foreground">{error?.message}</p>
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => refresh()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
      <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-foreground text-lg">User Management</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} of {users.length} users shown</p>
        </div>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-4 gap-2">
        {['customer','partner','driver','admin'].map(role => {
          const count = users.filter(u => u.role === role).length;
          const Icon  = ROLE_ICONS[role];
          return (
            <button key={role} onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}
              className={`rounded-xl p-3 text-center transition-all border ${
                roleFilter === role
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : `border-transparent ${ROLE_COLORS[role]}`
              }`}>
              <Icon className="w-4 h-4 mx-auto mb-1 opacity-80" />
              <p className="text-xl font-bold">{count}</p>
              <p className="text-[10px] capitalize">{role}s</p>
            </button>
          );
        })}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search name or email…" value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 rounded-xl" />
        </div>
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {ROLES.map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-colors ${
                roleFilter === r ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>{r}</button>
          ))}
        </div>
      </div>

      {/* User rows */}
      <div className="space-y-2">
        {filtered.map(user => {
          const Icon = ROLE_ICONS[user.role] || User;
          const isSuspended = user.approval_status === 'suspended';
          const { count, balance } = getUserSummary(user);

          return (
            <button key={user.email} onClick={() => setSelectedUser(user)}
              className={`w-full text-left bg-card rounded-2xl border p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors ${
                isSuspended ? 'opacity-60 border-red-200' : 'border-border'
              }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ROLE_COLORS[user.role]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-foreground">{user.full_name}</p>
                  <Badge className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[user.role]}`}>{user.role}</Badge>
                  {isSuspended && <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">Suspended</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {count} orders · {formatUSD(balance)} wallet
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 rotate-[-90deg]" />
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <User className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No users found</p>
          </div>
        )}
      </div>

      {/* User detail drawer */}
      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onRefresh={refresh}
        />
      )}
      </>
      )}
    </div>
  );
}

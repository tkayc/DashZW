import React, { useState, useEffect } from 'react';
import { formatUSD } from '@/lib/formatCurrency';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { User, Shield, Bike, Store, Search, X, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getBalance } from '@/api';
import { getCollectionSync } from '@/api';

const ROLE_ICONS = { customer: User, partner: Store, driver: Bike, admin: Shield, super_admin: Shield };
const ROLE_COLORS = {
  customer: 'bg-blue-50 text-blue-700',
  partner:  'bg-purple-50 text-purple-700',
  driver:   'bg-accent/10 text-accent',
  admin:    'bg-primary/10 text-primary',
  super_admin: 'bg-primary/10 text-primary',
};

export default function AdminUsers() {
  const { isAuthenticated } = useAuth();
  const [balances, setBalances] = useState({});
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-users-page'],
    queryFn: () => base44.auth.listUsers(),
    enabled: isAuthenticated,
    retry: 2,
  });

  useEffect(() => {
    if (!users.length) return;
    Promise.all(
      users.map(async (u) => {
        const type = u.role === 'admin' || u.role === 'super_admin' ? null : u.role;
        const bal = await getBalance(u.email, type).catch(() => 0);
        return [u.email, bal];
      })
    ).then((pairs) => setBalances(Object.fromEntries(pairs)));
  }, [users]);

  const filtered = users.filter((u) => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchQuery = !query || u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(query.toLowerCase());
    return matchRole && matchQuery;
  });

  const toggleApproval = async (user) => {
    try {
      const newStatus = user.approval_status === 'approved' ? 'suspended' : 'approved';
      await base44.auth.updateUser(user.email, { approval_status: newStatus });
      toast.success(`${user.full_name} ${newStatus === 'approved' ? 'reactivated' : 'suspended'}`);
      refetch();
    } catch (e) {
      toast.error(e.message || 'Could not update user');
    }
  };

  const getUserStats = (user) => {
    const orders = getCollectionSync('Order');
    const balance = balances[user.email] ?? 0;
    if (user.role === 'customer') {
      const mine = orders.filter((o) => o.customer_email === user.email);
      return { label: `${mine.length} orders`, balance: balance > 0 ? `${formatUSD(balance)} wallet` : null };
    }
    if (user.role === 'driver') {
      const mine = orders.filter((o) => o.driver_email === user.email && o.status === 'delivered');
      return { label: `${mine.length} deliveries`, balance: `${formatUSD(balance)} wallet` };
    }
    if (user.role === 'partner') {
      const mine = orders.filter((o) => o.partner_email === user.email && o.status === 'delivered');
      return { label: `${mine.length} orders`, balance: `${formatUSD(balance)} pending` };
    }
    return { label: '', balance: null };
  };

  const ROLES = ['all', 'customer', 'partner', 'driver', 'admin'];

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading users…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-card rounded-2xl border border-destructive/30 p-8 text-center space-y-3 max-w-lg">
        <p className="font-bold text-foreground">Could not load users</p>
        <p className="text-sm text-muted-foreground">{error?.message || 'Check that you are logged in as admin and the API is running.'}</p>
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">User Management</h1>
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 rounded-xl" />
        </div>
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {ROLES.map((r) => (
            <button key={r} type="button" onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                roleFilter === r ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
              }`}>{r}</button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} of {users.length} users</p>

      <div className="space-y-2">
        {filtered.map((user) => {
          const Icon = ROLE_ICONS[user.role] || User;
          const stats = getUserStats(user);
          const isSuspended = user.approval_status === 'suspended' || user.is_active === false;
          return (
            <div key={user.email} className={`bg-card rounded-2xl border p-4 flex items-center gap-3 ${
              isSuspended ? 'opacity-60 border-red-200' : 'border-border'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ROLE_COLORS[user.role] || ROLE_COLORS.customer}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-foreground">{user.full_name}</p>
                  <Badge className={`text-[10px] ${ROLE_COLORS[user.role] || ROLE_COLORS.customer}`}>{user.role}</Badge>
                  {isSuspended && <Badge className="bg-red-100 text-red-700 text-[10px]">Suspended</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {stats.label && <span className="text-[10px] text-muted-foreground">{stats.label}</span>}
                  {stats.balance && <span className="text-[10px] font-medium text-primary">{stats.balance}</span>}
                  <span className="text-[10px] text-muted-foreground">
                    Joined {new Date(user.created_date || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {user.role !== 'admin' && user.role !== 'super_admin' && (
                <button type="button" onClick={() => toggleApproval(user)}
                  className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${
                    isSuspended
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                  }`}>
                  {isSuspended
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> Reactivate</>
                    : <><XCircle className="w-3.5 h-3.5" /> Suspend</>
                  }
                </button>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <User className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No users match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

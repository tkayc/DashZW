import React, { useState, useEffect } from 'react';
import { base44 } from '@/api';
import { User, Shield, Bike, Store, Search, X, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getBalance } from '@/api';
import { getCollectionSync, getCollection } from '@/api';

const ROLE_ICONS = { customer: User, partner: Store, driver: Bike, admin: Shield };
const ROLE_COLORS = {
  customer: 'bg-blue-50 text-blue-700',
  partner:  'bg-purple-50 text-purple-700',
  driver:   'bg-accent/10 text-accent',
  admin:    'bg-primary/10 text-primary',
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [balances, setBalances] = useState({});
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const refresh = () => base44.auth.listUsers().then(setUsers);
  useEffect(() => { refresh(); }, []);

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
    const matchQuery = !query || u.email.toLowerCase().includes(query.toLowerCase()) ||
                       u.full_name?.toLowerCase().includes(query.toLowerCase());
    return matchRole && matchQuery;
  });

  const toggleApproval = async (user) => {
    const newStatus = user.approval_status === 'approved' ? 'suspended' : 'approved';
    await base44.auth.updateUser(user.email, { approval_status: newStatus });
    toast.success(`${user.full_name} ${newStatus === 'approved' ? 'reactivated' : 'suspended'}`);
    refresh();
  };

  const getUserStats = (user) => {
    const orders = getCollectionSync('Order');
    const balance = balances[user.email] ?? 0;
    if (user.role === 'customer') {
      const mine = orders.filter(o => o.customer_email === user.email);
      return { label: `${mine.length} orders`, balance: balance > 0 ? `R${balance.toFixed(2)} wallet` : null };
    }
    if (user.role === 'driver') {
      const mine = orders.filter(o => o.driver_email === user.email && o.status === 'delivered');
      return { label: `${mine.length} deliveries`, balance: `R${balance.toFixed(2)} wallet` };
    }
    if (user.role === 'partner') {
      const mine = orders.filter(o => o.partner_email === user.email && o.status === 'delivered');
      return { label: `${mine.length} orders`, balance: `R${balance.toFixed(2)} pending` };
    }
    return { label: '', balance: null };
  };

  const ROLES = ['all','customer','partner','driver','admin'];

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-bold text-foreground">User Management</h1>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or email…" value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 rounded-xl" />
        </div>
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {ROLES.map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                roleFilter === r ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
              }`}>{r}</button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} users</p>

      <div className="space-y-2">
        {filtered.map(user => {
          const Icon  = ROLE_ICONS[user.role] || User;
          const stats = getUserStats(user);
          const isSuspended = user.approval_status === 'suspended';
          return (
            <div key={user.email} className={`bg-card rounded-2xl border p-4 flex items-center gap-3 ${
              isSuspended ? 'opacity-60 border-red-200' : 'border-border'
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ROLE_COLORS[user.role]}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-foreground">{user.full_name}</p>
                  <Badge className={`text-[10px] ${ROLE_COLORS[user.role]}`}>{user.role}</Badge>
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
              {user.role !== 'admin' && (
                <button onClick={() => toggleApproval(user)}
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
      </div>
    </div>
  );
}

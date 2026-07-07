import React from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { useAuth } from '@/lib/AuthContext';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { User, TrendingUp, CheckCircle2, Wallet, AlertTriangle, Copy } from 'lucide-react';
import { useBalance } from '@/api';
import { getCollectionSync, getCollection } from '@/api';
import { toast } from 'sonner';

export default function DriverProfilePage() {
  const { user, logout } = useAuth();

  const { data: orders = [] } = useQuery({
    queryKey: ['driver-orders-profile', user?.email],
    queryFn: () => base44.entities.Order.filter({ driver_email: user.email }, '-created_date', 200),
    enabled: !!user?.email,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ['driver-txs', user?.email],
    queryFn: async () => {
      const all = getCollectionSync('Transaction');
      return all
        .filter(t => t.owner_email === user?.email && t.owner_type === 'driver')
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        .slice(0, 20);
    },
    enabled: !!user?.email,
  });

  const balance = useBalance(user?.email, 'driver');
  // Deliveries persist as 'completed' (delivered is a transient UI state), so
  // count both to avoid always showing 0 deliveries / $0 earned.
  const delivered   = orders.filter(o => ['delivered', 'completed'].includes(o.status));
  const active      = orders.filter(o => !['delivered', 'cancelled', 'completed', 'refunded'].includes(o.status)).length;
  const totalEarned = delivered.reduce((s, o) => s + (o.driver_earning || 0), 0);
  const driverID    = 'DRV-' + (user?.email || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);

  const copyDriverId = () => {
    navigator.clipboard?.writeText(driverID).catch(() => {});
    toast.success('Driver ID copied!');
  };

  return (
    <div className="space-y-5 max-w-md">
      <h1 className="text-xl font-bold text-foreground">Driver Profile</h1>

      {/* Identity card */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
            <User className="w-7 h-7 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-foreground truncate">{user?.full_name || 'Driver'}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-700 font-medium">Active Driver</span>
            </div>
          </div>
        </div>

        {/* Driver ID */}
        <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Driver ID — show at partner shops</p>
            <p className="text-xl font-bold tracking-widest text-foreground">{driverID}</p>
          </div>
          <button onClick={copyDriverId}
            className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center hover:bg-primary/20 shrink-0">
            <Copy className="w-4 h-4 text-primary" />
          </button>
        </div>
      </div>

      {/* Wallet */}
      <div className={`rounded-2xl border p-5 ${
        balance < 0 ? 'bg-red-50 border-red-200' :
        balance > 0 ? 'bg-green-50 border-green-200' :
        'bg-card border-border'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Wallet className={`w-5 h-5 ${balance < 0 ? 'text-red-600' : balance > 0 ? 'text-green-600' : 'text-primary'}`} />
            <h3 className="font-semibold text-foreground">Driver Wallet</h3>
          </div>
          <p className={`text-3xl font-bold ${balance < 0 ? 'text-red-700' : balance > 0 ? 'text-green-700' : 'text-foreground'}`}>
            {formatUSD(balance)}
          </p>
        </div>
        {balance < 0 && (
          <div className="flex items-start gap-2 mt-2 bg-red-100 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">
              Negative balance from cash deliveries. Visit any partner shop with your Driver ID to top up.
            </p>
          </div>
        )}
        {balance === 0 && (
          <p className="text-xs text-muted-foreground mt-1">Top up at a partner shop to accept COD orders.</p>
        )}
        {balance > 0 && (
          <p className="text-xs text-green-700 mt-1">You can accept COD orders up to {formatUSD(balance)}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Deliveries',   value: delivered.length,             icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
          { label: 'Total Earned', value: `${formatUSD(totalEarned.toFixed(2))}`, icon: Wallet,       color: 'bg-primary/10 text-primary' },
          { label: 'Active',       value: active,                       icon: TrendingUp,   color: 'bg-accent/10 text-accent' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-4 text-center">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Transactions */}
      {txs.length > 0 ? (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-foreground text-sm">Wallet Transactions</p>
          </div>
          <div className="divide-y divide-border">
            {txs.map((tx, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-xs text-foreground truncate">{tx.reason}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(tx.created_date).toLocaleDateString('en-ZA', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${tx.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {tx.amount >= 0 ? '+R' : '-R'}{Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Wallet className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No transactions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Complete a delivery to see wallet activity here</p>
        </div>
      )}

      {/* How it works */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
        <p className="font-semibold text-foreground text-sm">Wallet explained</p>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>💳 <strong>Online payments:</strong> Customer pays digitally. Your delivery fee is credited to your wallet automatically.</p>
          <p>💵 <strong>Cash on delivery:</strong> You collect the full order amount in cash. Your wallet is debited for the product cost + platform service fee. You keep your delivery fee portion as cash.</p>
          <p>📊 <strong>Example:</strong> R100 order, R5 delivery fee → you collect R105 cash. Wallet debited R100.15. You keep R4.85 cash delivery fee.</p>
          <p>🏪 <strong>Top up:</strong> Go to any partner shop, show your Driver ID, give them cash — they credit your wallet.</p>
        </div>
      </div>

      <button onClick={logout}
        className="w-full border border-destructive/30 text-destructive rounded-2xl py-3 text-sm font-semibold hover:bg-destructive/10 transition-colors">
        Sign Out
      </button>
    </div>
  );
}

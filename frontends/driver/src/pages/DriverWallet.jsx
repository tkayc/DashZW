import React from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { useAuth } from '@/lib/AuthContext';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { useBalance, getCollectionSync } from '@/api';
import { Wallet, ArrowUpRight, Gift, Zap, History, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ORDER_STATUS, normalizeOrderStatus } from '@/domain/orderStates';

/**
 * Driver wallet — balance, transactions, withdrawals, bonuses, tips, settlements, analytics.
 */
export default function DriverWallet() {
  const { user } = useAuth();
  const balance = useBalance(user?.email, 'driver');

  const { data: txs = [] } = useQuery({
    queryKey: ['driver-wallet-txs', user?.email],
    queryFn: async () => {
      const all = getCollectionSync('Transaction');
      return all
        .filter((t) => t.owner_email === user?.email && t.owner_type === 'driver')
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
        .slice(0, 30);
    },
    enabled: !!user?.email,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['driver-wallet-orders', user?.email],
    queryFn: () => base44.entities.Order.filter({ driver_email: user.email }, '-created_date', 100),
    enabled: !!user?.email,
  });

  const delivered = orders.filter((o) => {
    const s = normalizeOrderStatus(o.status);
    return s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.COMPLETED;
  });
  const tips = delivered.reduce((s, o) => s + (o.driver_tip || 0), 0);
  const earnings = delivered.reduce((s, o) => s + (o.driver_earning || 0), 0);
  const bonuses = 25; // mock incentive
  const incentives = 15; // mock

  return (
    <div className="space-y-5 max-w-lg">
      <h1 className="text-xl font-bold text-foreground">Driver Wallet</h1>

      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Available balance</p>
            <p className="text-3xl font-bold text-foreground">{formatUSD((balance || 0))}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full mt-3 rounded-xl"
          onClick={() => toast.message('Withdrawals coming soon')}
        >
          <ArrowUpRight className="w-4 h-4 mr-2" />
          Withdraw
        </Button>
        {/* TODO(payments): driver payout rails */}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Delivery earnings</p>
          <p className="text-lg font-bold">{formatUSD(earnings)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Tips</p>
          <p className="text-lg font-bold text-green-700">{formatUSD(tips)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Gift className="w-3 h-3" /> Bonuses
          </p>
          <p className="text-lg font-bold">{formatUSD(bonuses)}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Zap className="w-3 h-3" /> Incentives
          </p>
          <p className="text-lg font-bold">{formatUSD(incentives)}</p>
        </div>
      </div>

      {/* Earnings analytics */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="font-semibold text-sm flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4" /> Earnings analytics
        </p>
        <div className="flex items-end gap-1 h-20">
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/70 rounded-t"
              style={{ height: `${h}%` }}
              title={`Day ${i + 1}`}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">Last 7 days (mock chart)</p>
      </div>

      {/* Settlement history */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="font-semibold text-sm flex items-center gap-2 mb-2">
          <History className="w-4 h-4" /> Settlement history
        </p>
        <p className="text-xs text-muted-foreground">
          Settlements appear after completed deliveries. Full settlement ledger is a placeholder.
        </p>
        {/* TODO(payments): settlement_history */}
      </div>

      {/* Transactions */}
      <div className="bg-card rounded-2xl border border-border">
        <p className="font-semibold text-sm p-4 border-b border-border">Transactions</p>
        {txs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No transactions yet</p>
        ) : (
          <div className="divide-y divide-border max-h-80 overflow-auto">
            {txs.map((tx, i) => (
              <div key={tx.id || i} className="flex justify-between px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{tx.reason || tx.type}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {tx.created_date ? new Date(tx.created_date).toLocaleString() : ''}
                  </p>
                </div>
                <span className={`font-bold shrink-0 ${tx.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {tx.amount >= 0 ? '+' : ''}{formatUSD(Number(tx.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

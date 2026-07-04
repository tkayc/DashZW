import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useRealtimeQuery as useQuery } from '@/api';
import { Wallet, ArrowDownLeft, RefreshCw, Gift, Star } from 'lucide-react';
import { getCollection, getBalance } from '@/api';
import PageHeader from '@/components/layout/PageHeader';

/**
 * Customer wallet — view-only balance and history.
 * Balance changes only via server-side checkout deduction and system refunds.
 */
async function getCustomerTransactions(email) {
  if (!email) return [];
  const txs = await getCollection('Transaction');
  return txs
    .filter((t) => t.owner_email === email && t.owner_type === 'customer')
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
}

export default function CustomerWallet() {
  const { user, isGuest } = useAuth();

  const { data: txs = [] } = useQuery({
    queryKey: ['customer-txs', user?.email],
    queryFn: () => getCustomerTransactions(user?.email),
    enabled: !!user?.email && !isGuest,
  });

  const { data: balance = 0 } = useQuery({
    queryKey: ['customer-wallet-balance', user?.email],
    queryFn: () => getBalance(user.email, 'customer'),
    enabled: !!user?.email && !isGuest,
  });
  const totalRefunds = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const cashback = txs.filter((t) => (t.reason || '').toLowerCase().includes('cashback'));

  if (isGuest) {
    return (
      <div className="px-4 pt-6">
        <PageHeader title="Wallet" />
        <p className="text-sm text-muted-foreground">Sign in to view your wallet.</p>
        <Link to="/login" className="text-sm font-semibold text-primary mt-3 inline-block">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <PageHeader title="My Wallet" subtitle="Refunds, cashback & credits" />

      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground mb-4">
        <div className="flex items-center gap-2 mb-2 opacity-80">
          <Wallet className="w-4 h-4" />
          <span className="text-sm">Available balance</span>
        </div>
        <p className="text-4xl font-bold">R{balance.toFixed(2)}</p>
        <p className="text-xs opacity-70 mt-1">Wallet balance is used automatically at checkout</p>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl px-4 py-3 mb-4">
        <p className="text-sm text-muted-foreground">
          This balance is view-only. You cannot top up or withdraw. Credits come from refunds and
          promotions; deductions happen only when you pay for an order at checkout.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <ArrowDownLeft className="w-4 h-4 text-green-600 mx-auto mb-1" />
          <p className="text-lg font-bold">R{totalRefunds.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">Refunds</p>
        </div>
        <div className="bg-card rounded-2xl border border-border p-4 text-center">
          <RefreshCw className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-lg font-bold">{cashback.length}</p>
          <p className="text-[10px] text-muted-foreground">Cashback events</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5">
        <Link
          to="/loyalty"
          className="flex items-center gap-2 bg-card border border-border/50 rounded-2xl p-3"
        >
          <Star className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">Loyalty</span>
        </Link>
        <Link
          to="/gift-cards"
          className="flex items-center gap-2 bg-card border border-border/50 rounded-2xl p-3"
        >
          <Gift className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold">Gift cards</span>
        </Link>
      </div>

      <div className="bg-muted/50 rounded-2xl p-4 mb-5 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground text-sm mb-1">How credits work</p>
        <p>Refunds from unavailable items or cancelled prepaid orders.</p>
        <p>Cashback & loyalty redemptions will appear here when enabled.</p>
      </div>

      {txs.length > 0 ? (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-foreground">Transaction history</h3>
          </div>
          <div className="divide-y divide-border">
            {txs.map((tx, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 pr-3">
                  <p className="text-sm text-foreground">{tx.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.created_date).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold shrink-0 ${
                    tx.amount >= 0 ? 'text-green-700' : 'text-red-600'
                  }`}
                >
                  {tx.amount >= 0 ? '+' : ''}R{Math.abs(tx.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-foreground">No transactions yet</p>
        </div>
      )}
    </div>
  );
}

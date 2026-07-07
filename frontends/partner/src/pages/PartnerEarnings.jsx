import React, { useState, useEffect } from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { useAuth } from '@/lib/AuthContext';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { getBalance, useBalance } from '@/api';
import { getMerchantFinancialSummary, getPartnerSettlements } from '@/api';
import { getCollectionSync, getCollection } from '@/api';
import { DollarSign, TrendingUp, Clock, CheckCircle2, Wallet, Calendar } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { normalizeOrderStatus, ORDER_STATUS } from '@/domain/orderStates';

export default function PartnerEarnings() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('week'); // today|week|month|all

  const { data: shop } = useQuery({
    queryKey: ['partner-shop', user?.email],
    queryFn: () => base44.entities.Shop.filter({ owner_email: user?.email }).then(r => r[0]),
    enabled: !!user?.email,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['partner-orders-all', shop?.id],
    queryFn: () => base44.entities.Order.filter({ shop_id: shop.id }, '-created_date', 500),
    enabled: !!shop?.id,
  });

  const walletBalance  = useBalance(user?.email, 'partner');
  const [settlements, setSettlements] = useState([]);
  const [finSummary, setFinSummary] = useState(null);
  useEffect(() => {
    if (!user?.email) return;
    getPartnerSettlements(user.email).then(setSettlements).catch(() => setSettlements([]));
    getMerchantFinancialSummary(user.email).then(setFinSummary).catch(() => setFinSummary(null));
  }, [user?.email]);
  const txs            = getCollectionSync('Transaction').filter(t => t.owner_email === user?.email).slice(-20).reverse();

  // Filter by period
  const periodStart = {
    today: startOfDay(new Date()),
    week:  subDays(new Date(), 7),
    month: subDays(new Date(), 30),
    all:   new Date(0),
  }[period];

  const delivered = orders.filter(o => {
    const s = normalizeOrderStatus(o.status);
    return (s === ORDER_STATUS.DELIVERED || s === ORDER_STATUS.COMPLETED) &&
      new Date(o.created_date) >= periodStart;
  });
  const revenue    = delivered.reduce((s, o) => s + (o.partner_payout || 0), 0);
  const orderCount = delivered.length;
  const avgOrder   = orderCount ? revenue / orderCount : 0;

  // Daily breakdown for the period
  const dayMap = {};
  delivered.forEach(o => {
    const day = format(new Date(o.created_date), 'dd MMM');
    dayMap[day] = (dayMap[day] || 0) + (o.partner_payout || 0);
  });
  const dailyData = Object.entries(dayMap).slice(-7);
  const maxDaily  = Math.max(...dailyData.map(([,v]) => v), 1);

  const PERIODS = [
    { id: 'today', label: 'Today' },
    { id: 'week',  label: '7 days' },
    { id: 'month', label: '30 days' },
    { id: 'all',   label: 'All time' },
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-foreground">Earnings</h1>
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                period === p.id ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: DollarSign, label: 'Revenue', value: `${formatUSD(revenue.toFixed(2))}`, color: 'bg-green-50 text-green-700' },
          { icon: CheckCircle2, label: 'Orders', value: orderCount, color: 'bg-blue-50 text-blue-700' },
          { icon: TrendingUp, label: 'Avg Order', value: `${formatUSD(avgOrder.toFixed(2))}`, color: 'bg-purple-50 text-purple-700' },
          { icon: Wallet, label: 'Pending Payout', value: `${formatUSD(walletBalance.toFixed(2))}`, color: 'bg-primary/10 text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-4">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Mini bar chart */}
      {dailyData.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Daily Revenue</p>
          <div className="flex items-end gap-1.5 h-24">
            {dailyData.map(([day, val]) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="w-full bg-primary rounded-t-sm transition-all"
                  style={{ height: `${Math.max(4, (val / maxDaily) * 88)}px` }} />
                <span className="text-[9px] text-muted-foreground truncate w-full text-center">{day}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger settlement buckets */}
      {finSummary && (
        <div className="bg-card rounded-2xl border border-border p-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Pending Settlement</p>
            <p className="font-bold text-orange-700">{formatUSD(finSummary.pending_settlement?.toFixed(2) || '0.00')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Available Settlement</p>
            <p className="font-bold text-green-700">{formatUSD(finSummary.available_settlement?.toFixed(2) || '0.00')}</p>
          </div>
          {finSummary.next_settlement_date && (
            <div className="col-span-2 text-xs text-muted-foreground">
              Next settlement: {new Date(finSummary.next_settlement_date).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Wallet + settlement info */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="font-semibold text-foreground">Wallet Balance</p>
          <p className={`text-lg font-bold ${walletBalance > 0 ? 'text-green-700' : 'text-foreground'}`}>
            {formatUSD(walletBalance)}
          </p>
        </div>
        <div className="px-4 py-3 text-xs text-muted-foreground">
          <p>Your wallet accumulates from product sales and withdrawal fee shares.</p>
          <p className="mt-1">Admin will settle this balance to your EcoCash/bank account. Make sure your payout details are set in Shop Profile.</p>
        </div>
      </div>

      {/* Settlement history */}
      {settlements.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-foreground">Settlement History</p>
          </div>
          <div className="divide-y divide-border">
            {settlements.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {s.method?.toUpperCase()} · {s.reference}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(s.created_date).toLocaleDateString()}</p>
                </div>
                <p className="font-bold text-green-700">{formatUSD(s.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      {txs.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="font-semibold text-foreground">Recent Transactions</p>
          </div>
          <div className="divide-y divide-border">
            {txs.slice(0,10).map((tx, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <p className="text-xs text-muted-foreground flex-1 pr-2">{tx.reason}</p>
                <span className={`text-sm font-bold shrink-0 ${tx.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatUSDSigned(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

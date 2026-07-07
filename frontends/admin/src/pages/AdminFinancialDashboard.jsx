import React, { useEffect, useState } from 'react';
import { formatUSD } from '@/lib/formatCurrency';
import {
  getFinancialDashboard,
  getAuditLogs,
  filterTransactions,
} from '@/api';
import {
  DollarSign, TrendingUp, Users, Bike, Store, AlertTriangle,
  Wallet, ArrowDownCircle, ArrowUpCircle, Filter,
} from 'lucide-react';
import { format } from 'date-fns';

function Stat({ label, value, sub, color = 'text-foreground' }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminFinancialDashboard() {
  const [data, setData] = useState(null);
  const [audit, setAudit] = useState([]);
  const [filter, setFilter] = useState({ paymentMethod: 'all', transactionType: '' });
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getFinancialDashboard(filter),
      getAuditLogs(50),
      filterTransactions(filter),
    ])
      .then(([dash, logs, transactions]) => {
        setData(dash);
        setAudit(logs);
        setTxs(transactions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter.paymentMethod, filter.transactionType]);

  if (loading) {
    return <div className="p-6 animate-pulse space-y-4"><div className="h-32 bg-muted rounded-2xl" /></div>;
  }

  const p = data?.platform || {};

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Financial Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ledger-based view — DashZW as financial intermediary</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Platform Revenue" value={formatUSD(p.platform_revenue?.toFixed(2) || '0.00')} color="text-green-700" />
        <Stat label="Pending Revenue" value={formatUSD(p.pending_revenue?.toFixed(2) || '0.00')} />
        <Stat label="Merchant Liability" value={formatUSD(p.merchant_liability?.toFixed(2) || '0.00')} color="text-orange-700" />
        <Stat label="GMV (completed)" value={formatUSD(data?.gmv?.toFixed(2) || '0.00')} />
        <Stat label="Driver Float Total" value={formatUSD(p.driver_float_total?.toFixed(2) || '0.00')} />
        <Stat label="Outstanding COD" value={formatUSD(p.outstanding_cod_liability?.toFixed(2) || '0.00')} color="text-red-700" />
        <Stat label="Withdrawable (drivers)" value={formatUSD(p.withdrawable_driver_earnings?.toFixed(2) || '0.00')} />
        <Stat label="Daily Revenue" value={formatUSD(p.daily_revenue?.toFixed(2) || '0.00')} sub={`Week ${formatUSD(p.weekly_revenue?.toFixed(2) || '0')}`} />
      </div>

      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Filters</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'cash_on_delivery', 'ecocash', 'onemoney', 'innbucks'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setFilter((f) => ({ ...f, paymentMethod: m }))}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                filter.paymentMethod === m ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {m === 'all' ? 'All payments' : m.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <h2 className="font-semibold">Recent Ledger Transactions</h2>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {txs.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No transactions yet</p>
            ) : txs.slice(0, 30).map((tx) => (
              <div key={tx.id} className="px-4 py-3 flex justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{tx.transaction_type?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground">{tx.description || tx.account_id}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(tx.created_date || tx.created_at), 'dd MMM HH:mm')}</p>
                </div>
                <span className={tx.entry_side === 'credit' ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                  {tx.entry_side === 'credit' ? '+' : '−'}{formatUSD(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <h2 className="font-semibold">Audit Log</h2>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {audit.slice(0, 20).map((a) => (
              <div key={a.id} className="px-4 py-2 text-xs">
                <span className="font-semibold">{a.action}</span>
                <span className="text-muted-foreground"> · {a.actor_email || 'system'}</span>
                <p className="text-muted-foreground">{format(new Date(a.created_date || a.created_at), 'dd MMM HH:mm')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data?.merchant_summaries?.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Store className="w-4 h-4" /> Merchant Settlement</h2>
          <div className="space-y-2">
            {data.merchant_summaries.slice(0, 8).map((m) => (
              <div key={m.merchant_email} className="flex justify-between text-sm border-b border-border/50 pb-2">
                <span className="text-muted-foreground">{m.merchant_email}</span>
                <span>
                  Pending {formatUSD(m.pending_settlement?.toFixed(2))} · Available {formatUSD(m.available_settlement?.toFixed(2))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

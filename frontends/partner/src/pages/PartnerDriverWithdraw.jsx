import { formatUSD } from '@/lib/formatCurrency';
import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { Search, Wallet, CheckCircle2, AlertTriangle, Loader2, DollarSign } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getBalance } from '@/api';
import { driverWithdraw, getWithdrawals } from '@/api';
import { getCollectionSync, getCollection } from '@/api';

export default function PartnerDriverWithdraw() {
  const { user } = useAuth();

  const { data: shop } = useQuery({
    queryKey: ['my-shop', user?.email],
    queryFn: () => base44.entities.Shop.filter({ owner_email: user?.email }).then(r => r[0]),
    enabled: !!user?.email,
  });

  const [driverIdInput, setDriverIdInput]   = useState('');
  const [amount, setAmount]                 = useState('');
  const [foundDriver, setFoundDriver]       = useState(null);
  const [searching, setSearching]           = useState(false);
  const [processing, setProcessing]         = useState(false);
  const [done, setDone]                     = useState(null);

  if (!user || user.role !== 'partner') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <AlertTriangle className="w-10 h-10 text-destructive mb-3" />
        <p className="font-semibold text-foreground">Access Denied</p>
      </div>
    );
  }

  const searchDriver = async () => {
    if (!driverIdInput.trim()) return;
    setSearching(true); setFoundDriver(null); setDone(null);

    await new Promise(r => setTimeout(r, 200));
    const inputId = driverIdInput.trim().toUpperCase();

    const orders = getCollectionSync('Order');
    const driverEmails = [...new Set(orders.filter(o => o.driver_email).map(o => o.driver_email))];
    const knownDrivers = ['driver1@dashzw.com', 'driver2@dashzw.com', 'driver3@dashzw.com'];
    const allDriverEmails = [...new Set([...knownDrivers, ...driverEmails])];

    let found = null;
    for (const email of allDriverEmails) {
      const genId = 'DRV-' + email.replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,6);
      if (genId === inputId) {
        const balance = await getBalance(email, 'driver').catch(() => 0);
        found = {
          email,
          name: email.split('@')[0],
          balance,
          driverId: inputId,
        };
        break;
      }
    }

    if (found) setFoundDriver(found);
    else toast.error('Driver ID not found');
    setSearching(false);
  };

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!foundDriver || !shop) return;

    setProcessing(true);
    try {
      const record = await driverWithdraw({
        driverEmail: foundDriver.email,
        driverName:  foundDriver.name,
        partnerEmail: user.email,
        shopName: shop.name,
        amount: amt,
      });
      setDone(record);
      const balance = await getBalance(foundDriver.email, 'driver').catch(() => 0);
      setFoundDriver({ ...foundDriver, balance });
      setAmount('');
      toast.success(`Withdrawal processed! Pay driver ${formatUSD(amt.toFixed(2))} cash.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const WITHDRAWAL_FEE = 0.50;
  const totalDeducted = amount ? parseFloat((parseFloat(amount) + WITHDRAWAL_FEE).toFixed(2)) : 0;

  return (
    <div className="max-w-md space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Driver Wallet Withdrawal</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Driver pays you nothing — this reduces their digital wallet. You pay them the cash amount.
        </p>
      </div>

      {/* Fee info */}
      <div className="bg-muted/50 rounded-2xl p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground text-sm">Withdrawal fee: $0.50</p>
        <p>→ R0.30 goes to platform · R0.20 goes to your shop wallet</p>
        <p>Driver's wallet is reduced by: withdrawal amount + R0.50 fee</p>
        <p>You pay the driver exactly the withdrawal amount in cash</p>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        {/* Search */}
        <div className="space-y-1.5">
          <Label>Driver ID</Label>
          <div className="flex gap-2">
            <Input placeholder="e.g. DRV-DRIVER"
              value={driverIdInput}
              onChange={e => { setDriverIdInput(e.target.value.toUpperCase()); setFoundDriver(null); setDone(null); }}
              className="rounded-xl font-mono" />
            <Button onClick={searchDriver} disabled={searching || !driverIdInput.trim()} className="rounded-xl shrink-0">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">The driver's ID is shown on their profile page</p>
        </div>

        {/* Found driver */}
        {foundDriver && (
          <div className={`rounded-xl p-4 border ${
            foundDriver.balance <= 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-foreground" />
              <span className="font-semibold text-sm">{foundDriver.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{foundDriver.driverId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Wallet balance:</span>
              <span className={`font-bold ${foundDriver.balance > 0 ? 'text-green-700' : foundDriver.balance < 0 ? 'text-red-700' : 'text-foreground'}`}>
                ${foundDriver.balance.toFixed(2)}
              </span>
            </div>
            {foundDriver.balance <= 0 && (
              <p className="text-xs text-yellow-700 mt-1">Balance is $0 or negative — driver may not have enough to withdraw.</p>
            )}
          </div>
        )}

        {/* Amount + breakdown */}
        {foundDriver && !done && (
          <>
            <div className="space-y-1.5">
              <Label>Withdrawal Amount ($)</Label>
              <Input type="number" min="1" step="0.50" placeholder="Amount driver wants to withdraw"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="rounded-xl" />
            </div>

            {amount && parseFloat(amount) > 0 && (
              <div className="bg-muted/50 rounded-xl p-3 space-y-1 text-xs">
                <div className="flex justify-between font-semibold text-foreground">
                  <span>Driver wallet debited</span>
                  <span>−${parseFloat(amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Platform gets (fee)</span>
                  <span>+R0.30</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Your shop gets (fee share)</span>
                  <span>+R0.20</span>
                </div>
                <div className="border-t border-border pt-1 flex justify-between font-semibold text-green-700">
                  <span>You pay driver in cash</span>
                  <span>${Math.max(0, parseFloat(amount) - 0.50).toFixed(2)}</span>
                </div>
                <p className="text-muted-foreground pt-1">
                  Verification: ${Math.max(0, parseFloat(amount)-0.50).toFixed(2)} (cash) + R0.30 + R0.20 = ${parseFloat(amount).toFixed(2)} ✓
                </p>
              </div>
            )}

            <Button onClick={handleWithdraw}
              disabled={processing || !amount || parseFloat(amount) <= 0}
              className="w-full rounded-xl">
              {processing
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                : `Process — Pay Driver ${formatUSD(Math.max(0, parseFloat(amount||0) - 0.50).toFixed(2))} Cash`
              }
            </Button>
          </>
        )}

        {done && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
            <p className="font-bold text-foreground">Withdrawal Complete!</p>
            <p className="text-sm text-muted-foreground">
              Pay <strong>{foundDriver.name}</strong> <strong>${done.cash_to_driver.toFixed(2)}</strong> cash now.
            </p>
            <p className="text-xs text-muted-foreground">(R0.50 fee deducted from withdrawal)</p>
            <p className="text-xs text-muted-foreground">Driver wallet balance: ${foundDriver.balance.toFixed(2)}</p>
            <Button variant="outline" className="mt-2 rounded-xl"
              onClick={() => { setDone(null); setFoundDriver(null); setDriverIdInput(''); }}>
              Process another withdrawal
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

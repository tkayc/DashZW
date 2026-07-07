import { formatUSD } from '@/lib/formatCurrency';
import React, { useState } from 'react';
import { Wallet, Search, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getCollectionSync, getCollection } from '@/api';
import { topUpDriver, getBalance } from '@/api';
import { useAuth } from '@/lib/AuthContext';

export default function PartnerDriverTopUp() {
  const { user } = useAuth();

  const [driverIdInput, setDriverIdInput] = useState('');
  const [amount, setAmount] = useState('');
  const [foundDriver, setFoundDriver] = useState(null);
  const [searching, setSearching] = useState(false);
  const [topping, setTopping] = useState(false);
  const [done, setDone] = useState(false);

  // Guard: only partners can access this
  if (!user || user.role !== 'partner') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <AlertTriangle className="w-10 h-10 text-destructive mb-3" />
        <p className="font-semibold text-foreground">Access Denied</p>
        <p className="text-sm text-muted-foreground mt-1">You must be logged in as a partner to top up drivers.</p>
      </div>
    );
  }

  const searchDriver = async () => {
    if (!driverIdInput.trim()) return;
    setSearching(true);
    setFoundDriver(null);
    setDone(false);
    await new Promise(r => setTimeout(r, 300));

    // Driver ID format: DRV-XXXXXX derived from email
    const allUsers = [
      { email: 'driver@demo.com', full_name: 'Pat Driver', role: 'driver' },
      // In a real app, this would query a users collection
    ];
    // Check via wallets — find driver whose ID matches
    const wallets = getCollectionSync('Wallet');
    const driverWallets = wallets.filter(w => w.owner_type === 'driver');

    // Also check orders for driver emails
    const orders = getCollectionSync('Order');
    const driverEmails = [...new Set(orders.filter(o => o.driver_email).map(o => o.driver_email))];

    // Generate ID from email and match
    const inputId = driverIdInput.trim().toUpperCase();
    let matchEmail = null;

    // Check demo user
    for (const email of ['driver1@dashzw.com', 'driver2@dashzw.com', 'driver3@dashzw.com', ...driverEmails]) {
      const genId = 'DRV-' + email.replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,6);
      if (genId === inputId) { matchEmail = email; break; }
    }

    if (matchEmail) {
      const bal = await getBalance(matchEmail, 'driver');
      setFoundDriver({ email: matchEmail, balance: bal, driverId: inputId });
    } else {
      toast.error('Driver ID not found');
    }
    setSearching(false);
  };

  const handleTopUp = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!foundDriver) return;
    setTopping(true);
    try {
      await topUpDriver(foundDriver.email, amt, user?.email);
      // topUpDriver returns a float summary object, not a number — re-read the
      // scalar balance so the UI (foundDriver.balance.toFixed) stays valid.
      const refreshed = await getBalance(foundDriver.email, 'driver');
      toast.success(`${formatUSD(amt.toFixed(2))} topped up for ${foundDriver.driverId}`);
      setFoundDriver({ ...foundDriver, balance: refreshed });
      setAmount('');
      setDone(true);
    } catch (err) {
      toast.error(err?.message || 'Top-up failed. Please try again.');
    } finally {
      setTopping(false);
    }
  };

  return (
    <div className="max-w-md space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Driver Wallet Top-Up</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Driver pays you cash — you credit their digital wallet</p>
      </div>

      {/* Search */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
        <div className="space-y-1.5">
          <Label>Driver ID</Label>
          <div className="flex gap-2">
            <Input placeholder="e.g. DRV-DRIVER" value={driverIdInput}
              onChange={e => { setDriverIdInput(e.target.value.toUpperCase()); setFoundDriver(null); setDone(false); }}
              className="rounded-xl font-mono" />
            <Button onClick={searchDriver} disabled={searching || !driverIdInput.trim()} className="rounded-xl shrink-0">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">The driver's ID is shown on their profile page</p>
        </div>

        {/* Found driver */}
        {foundDriver && (
          <div className={`rounded-xl p-4 border ${foundDriver.balance <= -5 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {foundDriver.balance <= -5
                ? <AlertTriangle className="w-4 h-4 text-red-600" />
                : <CheckCircle2 className="w-4 h-4 text-green-600" />}
              <span className="font-semibold text-sm text-foreground">{foundDriver.driverId}</span>
            </div>
            <p className="text-xs text-muted-foreground">Current balance:
              <span className={`font-bold ml-1 ${foundDriver.balance < 0 ? 'text-red-700' : 'text-green-700'}`}>
                ${foundDriver.balance.toFixed(2)}
              </span>
            </p>
          </div>
        )}

        {/* Amount */}
        {foundDriver && !done && (
          <div className="space-y-1.5">
            <Label>Cash Received ($)</Label>
            <Input type="number" min="0.5" step="0.5" placeholder="Amount driver paid you in cash"
              value={amount} onChange={e => setAmount(e.target.value)} className="rounded-xl" />
          </div>
        )}

        {foundDriver && !done && (
          <Button onClick={handleTopUp} disabled={topping || !amount} className="w-full rounded-xl">
            {topping ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : `Top Up ${formatUSD(parseFloat(amount || 0).toFixed(2))}`}
          </Button>
        )}

        {done && (
          <div className="flex items-center gap-2 justify-center py-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-green-700">Top-up successful!</span>
          </div>
        )}
      </div>

      <div className="bg-muted/50 rounded-2xl p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground text-sm mb-2">How it works</p>
        <p>1. Driver comes to your shop with cash and their Driver ID</p>
        <p>2. Enter their ID above to look them up</p>
        <p>3. Enter the cash amount they're paying</p>
        <p>4. Click Top Up — their wallet is credited instantly</p>
        <p>5. You keep the cash as reimbursement for cash deliveries</p>
      </div>
    </div>
  );
}

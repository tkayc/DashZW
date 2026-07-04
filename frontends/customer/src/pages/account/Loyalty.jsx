import React from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { useAuth } from '@/lib/AuthContext';
import { Star } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { getPoints, REDEEM_AT, REDEEM_VALUE } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { toast } from 'sonner';

/**
 * Loyalty hub — points accrue on completed orders (backend awardPoints).
 *
 * TODO(postgresql): loyalty_accounts + loyalty_redemptions tables.
 * TODO(backend): Wire redeem endpoint to credit wallet when points >= REDEEM_AT.
 */
export default function Loyalty() {
  const { user } = useAuth();

  const { data: loyalty = { points: 0 } } = useQuery({
    queryKey: ['loyalty', user?.email],
    queryFn: () => getPoints(user.email),
    enabled: !!user?.email,
  });

  const pts = loyalty.points ?? 0;
  const progress = Math.min(100, (pts / REDEEM_AT) * 100);
  const toNext = pts % REDEEM_AT === 0 && pts > 0 ? 0 : REDEEM_AT - (pts % REDEEM_AT);

  const handleRedeem = () => {
    toast.message('Redeem coming soon', {
      description: `Earn ${REDEEM_AT} pts to unlock ${formatUSD(REDEEM_VALUE)} wallet credit.`,
    });
    // TODO(backend): POST /api/loyalty/redeem
  };

  return (
    <div className="px-4 pt-6 pb-8">
      <PageHeader title="Loyalty" subtitle="Earn points on every completed order" />

      <div className="bg-card rounded-2xl border border-border/50 p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Star className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{pts} pts</p>
            <p className="text-xs text-muted-foreground">Lifetime balance</p>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5 mb-2">
          <div className="bg-primary rounded-full h-2.5 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {pts >= REDEEM_AT
            ? `You can redeem ${formatUSD(REDEEM_VALUE)} (preview — button below).`
            : `${toNext} more points for ${formatUSD(REDEEM_VALUE)} reward`}
        </p>
        <button
          type="button"
          onClick={handleRedeem}
          className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
        >
          Redeem points
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-2">
        <p className="font-semibold text-sm text-foreground">How it works</p>
        <p className="text-xs text-muted-foreground">1 point per R10 spent on completed orders.</p>
        <p className="text-xs text-muted-foreground">
          {REDEEM_AT} points = {formatUSD(REDEEM_VALUE)} wallet credit.
        </p>
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-2">
          Redemption is a placeholder UI. Points already update when orders complete.
        </p>
      </div>
    </div>
  );
}

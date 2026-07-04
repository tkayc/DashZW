import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { MOCK_DEALS, PROMO_TYPES } from '@/domain/promotions';

/**
 * Promotion framework surface.
 * Checkout already applies shop + platform coupons.
 * TODO(postgresql): promotions, promo_redemptions, flash_sales.
 */
export default function Deals() {
  const types = Object.values(PROMO_TYPES);

  return (
    <div className="px-4 pt-6 pb-8">
      <PageHeader title="Deals & promos" subtitle="Coupons, flash sales, loyalty & more" />

      <div className="flex flex-wrap gap-2 mb-4">
        {types.map((t) => (
          <span key={t} className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-1 rounded-lg capitalize">
            {t.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {MOCK_DEALS.map((d) => (
          <div key={d.id} className="bg-card border border-border/50 rounded-2xl p-4 flex gap-3">
            <span className="text-3xl">{d.emoji}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-foreground">{d.title}</p>
                <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                  {d.badge}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{d.body}</p>
              <p className="text-[10px] text-muted-foreground mt-2 capitalize">{d.type.replace(/_/g, ' ')}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2 mt-4">
        Apply codes at checkout. Merchant & platform promos already work via the coupon field.
      </p>
    </div>
  );
}

import { formatUSD } from '@/lib/formatCurrency';
import React, { useState } from 'react';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { Tag, Percent, Gift, Calendar, Zap, Copy, ChevronDown, ChevronUp } from 'lucide-react';

const TYPE_CONFIG = {
  percentage_discount: { icon: Percent, color: 'bg-green-50 border-green-200 text-green-800', badge: 'bg-green-100 text-green-700' },
  fixed_discount:      { icon: Tag,     color: 'bg-blue-50 border-blue-200 text-blue-800',   badge: 'bg-blue-100 text-blue-700' },
  bogo:                { icon: Gift,    color: 'bg-purple-50 border-purple-200 text-purple-800', badge: 'bg-purple-100 text-purple-700' },
  coupon_code:         { icon: Copy,    color: 'bg-orange-50 border-orange-200 text-orange-800', badge: 'bg-orange-100 text-orange-700' },
  happy_hour:          { icon: Calendar,color: 'bg-pink-50 border-pink-200 text-pink-800',   badge: 'bg-pink-100 text-pink-700' },
  free_delivery:       { icon: Zap,     color: 'bg-cyan-50 border-cyan-200 text-cyan-800',   badge: 'bg-cyan-100 text-cyan-700' },
};

function isPromoValid(promo) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][today.getDay()];

  if (promo.start_date && todayStr < promo.start_date) return false;
  if (promo.end_date && todayStr > promo.end_date) return false;
  if (promo.applicable_days?.length > 0 && !promo.applicable_days.includes(dayName)) return false;
  if (promo.max_uses && promo.times_used >= promo.max_uses) return false;
  return true;
}

function PromoLabel({ promo }) {
  const cfg = TYPE_CONFIG[promo.promo_type] || TYPE_CONFIG.fixed_discount;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
      {promo.promo_type === 'percentage_discount' && `${promo.discount_value}% OFF`}
      {promo.promo_type === 'fixed_discount' && `${formatUSD(promo.discount_value)} OFF`}
      {promo.promo_type === 'bogo' && 'BUY 1 GET 1'}
      {promo.promo_type === 'free_delivery' && 'FREE DELIVERY'}
      {promo.promo_type === 'coupon_code' && `CODE: ${promo.coupon_code}`}
      {promo.promo_type === 'happy_hour' && '🎉 SPECIAL'}
    </span>
  );
}

export default function ShopPromotions({ shopId }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(null);

  const { data: promos = [] } = useQuery({
    queryKey: ['shop-promos', shopId],
    queryFn: () => base44.entities.Promotion.filter({ shop_id: shopId, is_active: true }),
    enabled: !!shopId,
  });

  const validPromos = promos.filter(isPromoValid);
  if (validPromos.length === 0) return null;

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const shown = expanded ? validPromos : validPromos.slice(0, 2);

  return (
    <div className="px-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Tag className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Deals & Promotions</h3>
        <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
          {validPromos.length}
        </span>
      </div>

      <div className="space-y-2">
        {shown.map(promo => {
          const cfg = TYPE_CONFIG[promo.promo_type] || TYPE_CONFIG.fixed_discount;
          const Icon = cfg.icon;
          return (
            <div key={promo.id} className={`rounded-xl border p-3 ${cfg.color}`}>
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm">{promo.title}</p>
                    <PromoLabel promo={promo} />
                  </div>
                  {promo.description && (
                    <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{promo.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {promo.min_order_amount && (
                      <span className="text-[10px] opacity-70">Min order ${promo.min_order_amount}</span>
                    )}
                    {promo.applicable_days?.length > 0 && promo.applicable_days.length < 7 && (
                      <span className="text-[10px] opacity-70">
                        {promo.applicable_days.map(d => d.slice(0,3)).join(', ')} only
                      </span>
                    )}
                    {promo.end_date && (
                      <span className="text-[10px] opacity-70">Ends {promo.end_date}</span>
                    )}
                    {promo.coupon_code && (
                      <button
                        onClick={() => copyCode(promo.coupon_code, promo.id)}
                        className="flex items-center gap-1 text-[10px] font-bold bg-white/60 px-2 py-1 rounded-lg hover:bg-white/80 transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                        {copied === promo.id ? '✓ Copied!' : `Copy code: ${promo.coupon_code}`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {validPromos.length > 2 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-xs text-primary font-semibold mt-2"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Show less' : `Show ${validPromos.length - 2} more deals`}
        </button>
      )}
    </div>
  );
}

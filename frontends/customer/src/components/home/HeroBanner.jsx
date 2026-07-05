import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SHOP_DEAL_ADS } from '@/domain/promotions';

const ROTATE_MS = 3000;

export default function HeroBanner({ ads = SHOP_DEAL_ADS }) {
  const [active, setActive] = useState(0);
  const count = ads.length;

  const goTo = useCallback((index) => {
    setActive(((index % count) + count) % count);
  }, [count]);

  useEffect(() => {
    if (count <= 1) return undefined;
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % count);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [count]);

  return (
    <div className="mx-4 mt-3">
      <div className="relative overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {ads.map((ad) => (
            <Link
              key={ad.id}
              to={`/shop/${ad.shopId}`}
              className={`relative block w-full shrink-0 overflow-hidden bg-gradient-to-br ${ad.accent} p-5 min-h-[148px]`}
            >
              <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-5 -translate-x-5" />
              <div className="relative z-10 flex flex-col h-full min-h-[118px]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider">
                      {ad.shopName}
                    </p>
                    <h2 className="text-white text-lg font-bold leading-snug mt-0.5">
                      {ad.title}
                    </h2>
                    <p className="text-white/75 text-xs mt-1 line-clamp-2">{ad.subtitle}</p>
                  </div>
                  <span className="shrink-0 w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center p-1.5" aria-hidden>
                    {ad.iconSrc ? (
                      <img src={ad.iconSrc} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-3xl drop-shadow-md">{ad.emoji}</span>
                    )}
                  </span>
                </div>
                <span className="mt-auto inline-flex items-center gap-0.5 text-xs font-semibold text-white bg-white/20 self-start px-3 py-1.5 rounded-xl hover:bg-white/30 transition-colors">
                  {ad.cta}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {ads.map((ad, i) => (
            <button
              key={ad.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show deal from ${ad.shopName}`}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

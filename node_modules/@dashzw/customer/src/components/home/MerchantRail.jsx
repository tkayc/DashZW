import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import ShopCard from '@/components/shared/ShopCard';

export default function MerchantRail({ title, shops, isLoading, seeAllTo = '/explore', emptyLabel }) {
  if (isLoading) {
    return (
      <div className="px-4 mt-6">
        <div className="h-5 w-36 bg-muted rounded-lg animate-pulse mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2].map((i) => (
            <div key={i} className="min-w-[260px] h-44 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!shops?.length) {
    if (!emptyLabel) return null;
    return (
      <div className="px-4 mt-6">
        <h2 className="text-lg font-bold text-foreground mb-2">{title}</h2>
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="px-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
        {seeAllTo && (
          <Link to={seeAllTo} className="flex items-center gap-0.5 text-primary text-xs font-semibold">
            See all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {shops.slice(0, 8).map((shop) => (
          <div key={shop.id} className="min-w-[260px]">
            <ShopCard shop={shop} variant="wide" />
          </div>
        ))}
      </div>
    </div>
  );
}

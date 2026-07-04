import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import ShopCard from '@/components/shared/ShopCard';

export default function FeaturedShops({ shops, isLoading }) {
  if (isLoading) {
    return (
      <div className="px-4 mt-6">
        <div className="h-6 w-40 bg-muted rounded-lg animate-pulse mb-3" />
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="min-w-[280px] h-52 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!shops?.length) return null;

  return (
    <div className="px-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-foreground">Featured Merchants</h2>
        <Link to="/explore" className="flex items-center gap-0.5 text-primary text-xs font-semibold">
          See all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        {shops.slice(0, 6).map(shop => (
          <ShopCard key={shop.id} shop={shop} variant="wide" />
        ))}
      </div>
    </div>
  );
}
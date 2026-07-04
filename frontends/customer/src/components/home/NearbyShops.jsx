import React from 'react';
import ShopCard from '@/components/shared/ShopCard';

export default function NearbyShops({ shops, isLoading }) {
  if (isLoading) {
    return (
      <div className="px-4 mt-6">
        <div className="h-6 w-32 bg-muted rounded-lg animate-pulse mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-52 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!shops?.length) return null;

  return (
    <div className="px-4 mt-6 mb-4">
      <h2 className="text-lg font-bold text-foreground mb-3">Nearby</h2>
      <div className="grid grid-cols-2 gap-3">
        {shops.map(shop => (
          <ShopCard key={shop.id} shop={shop} />
        ))}
      </div>
    </div>
  );
}
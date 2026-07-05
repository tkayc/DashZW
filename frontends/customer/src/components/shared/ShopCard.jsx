import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Clock, Bike } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getShopStatus } from '@/api';
import { formatUSD } from '@/lib/formatCurrency';

export default function ShopCard({ shop, variant = 'default' }) {
  const isWide = variant === 'wide';
  const { isOpen, closingSoon, minutesUntilClose } = getShopStatus(shop);

  return (
    <Link to={`/shop/${shop.id}`} className="block group w-full">
      <div className="bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 border border-border/50">

        {/* Image — blurred when closed, no overlays on top of image */}
        <div className="relative h-36 overflow-hidden">
          <img
            src={shop.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80'}
            alt={shop.name}
            className={`w-full h-full object-cover transition-transform duration-500 ${!isOpen ? 'blur-[2px]' : 'group-hover:scale-[1.03]'}`}
          />
          {/* CLOSED text centred over the blur — no opening time here */}
          {!isOpen && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white font-bold text-lg tracking-widest drop-shadow-lg">CLOSED</span>
            </div>
          )}
        </div>

        {/* Info row */}
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-foreground text-sm leading-tight">{shop.name}</h3>
            <div className="flex items-center gap-0.5 bg-secondary px-1.5 py-0.5 rounded-lg shrink-0">
              <Star className="w-3 h-3 text-accent fill-accent" />
              <span className="text-xs font-semibold text-secondary-foreground">{shop.rating?.toFixed(1) || '4.5'}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {shop.description || shop.category?.replace('_', ' ')}
          </p>

          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            {isOpen ? (
              <>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">{shop.estimated_delivery_time || '25-40 min'}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Bike className="w-3 h-3" />
                  <span className="text-xs">
                    {shop.delivery_fee != null ? formatUSD(shop.delivery_fee) : 'Fee at checkout'}
                  </span>
                </div>
                {shop.distance_km != null && (
                  <span className="text-xs text-muted-foreground">{shop.distance_km.toFixed(1)} km</span>
                )}
                {shop.category === 'grocery' && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">Free delivery promos</Badge>
                )}
                {/* Closing soon shown inline in the bottom row */}
                {closingSoon && (
                  <span className="text-xs font-semibold text-orange-600 ml-auto">
                    ⏰ Closes in {minutesUntilClose} min
                  </span>
                )}
              </>
            ) : (
              /* Closed — show opening hours in the bottom row */
              <>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">{shop.opening_hours || 'Hours not set'}</span>
                </div>
                <span className="text-xs text-muted-foreground ml-auto italic">Browse menu</span>
              </>
            )}
          </div>
        </div>

      </div>
    </Link>
  );
}

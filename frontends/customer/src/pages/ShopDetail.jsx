import React, { useState, useEffect } from 'react';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Star, Clock, Bike, MapPin, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import MenuItemCard from '@/components/shop/MenuItemCard';
import ShopReviews from '@/components/reviews/ShopReviews';
import ShopPromotions from '@/components/shop/ShopPromotions';
import { getShopStatus, formatOpeningHours } from '@/api';
import { getMerchantCategory } from '@/domain/merchantCategories';
import { isMerchantFavourite, toggleMerchantFavourite } from '@/lib/favourites';
import { trackMerchantView } from '@/lib/recentlyViewed';
import { toast } from 'sonner';

/**
 * Merchant detail — same layout for restaurants, grocery, pharmacy, etc.
 * Catalog sections use product categories from MenuItem.category.
 */
export default function ShopDetail() {
  const { id: shopId } = useParams();
  const navigate = useNavigate();
  const [fav, setFav] = useState(() => isMerchantFavourite(shopId));

  const { data: shop, isLoading: shopLoading, isError: shopError, error: shopLoadError } = useQuery({
    queryKey: ['shop', shopId],
    queryFn: async () => {
      const shops = await base44.entities.Shop.filter({ id: shopId });
      return shops[0];
    },
    enabled: !!shopId,
  });

  const { data: menuItems, isPending: menuLoading, isError: menuError, error: menuLoadError } = useQuery({
    queryKey: ['menu', shopId],
    queryFn: () => base44.entities.MenuItem.filter({ shop_id: shopId }),
    enabled: !!shopId,
  });

  const shopStatus = shop ? getShopStatus(shop) : { isOpen: true, closingSoon: false };
  const orderingBlocked = !shopStatus.isOpen || shopStatus.closingSoon;
  const merchantCat = shop ? getMerchantCategory(shop.category) : null;

  useEffect(() => {
    if (shop?.id) trackMerchantView(shop.id);
  }, [shop?.id]);

  const handleFavourite = () => {
    const on = toggleMerchantFavourite(shopId);
    setFav(on);
    toast.success(on ? 'Saved to favourites' : 'Removed from favourites');
  };

  // Group menu items by category
  const grouped = (menuItems || []).reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  if (shopLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-56 bg-muted" />
        <div className="px-4 py-4 space-y-3">
          <div className="h-6 w-48 bg-muted rounded-lg" />
          <div className="h-4 w-64 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (shopError) {
    return (
      <div className="text-center py-20 px-4">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="font-semibold text-foreground">Could not load merchant</p>
        <p className="text-sm text-muted-foreground mt-1">{shopLoadError?.message || 'Please check your connection and try again.'}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="text-center py-20 px-4">
        <p className="text-4xl mb-3">😕</p>
        <p className="font-semibold text-foreground">Merchant not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="pb-4">
      {/* Header Image */}
      <div className="relative h-56">
        <img
          src={shop.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80'}
          alt={shop.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleFavourite}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center"
        >
          <Heart className={`w-4 h-4 ${fav ? 'fill-red-500 text-red-500' : ''}`} />
        </button>
      </div>

      {/* Shop Info */}
      <div className="px-4 -mt-8 relative z-10">
        <div className="bg-card rounded-2xl p-4 shadow-lg border border-border/50">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground">{shop.name}</h1>
                {merchantCat && (
                  <Badge variant="secondary" className="text-[10px]">
                    {merchantCat.icon} {merchantCat.label}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{shop.description}</p>
            </div>
            {!shopStatus.isOpen && (
              <Badge variant="destructive" className="shrink-0">Closed</Badge>
            )}
            {shopStatus.closingSoon && shopStatus.isOpen && (
              <Badge className="bg-orange-500 text-white shrink-0">
                Closes in {shopStatus.minutesUntilClose} min
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-accent fill-accent" />
              <span className="text-xs font-semibold">{shop.rating?.toFixed(1) || '4.5'}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs">{shop.estimated_delivery_time || '25-40 min'}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Bike className="w-3.5 h-3.5" />
              <span className="text-xs">Delivery from R1.00</span>
            </div>
          </div>
          {shop.address && (
            <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs">{shop.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Closed / closing-soon banner */}
      {orderingBlocked && (
        <div className={`mx-4 mt-4 rounded-2xl px-4 py-3 flex items-start gap-3 ${
          shopStatus.closingSoon ? 'bg-orange-50 border border-orange-200' : 'bg-muted border border-border'
        }`}>
          <span className="text-xl">{shopStatus.closingSoon ? '⏰' : '🔒'}</span>
          <div>
            <p className={`font-semibold text-sm ${shopStatus.closingSoon ? 'text-orange-800' : 'text-foreground'}`}>
              {shopStatus.closingSoon
                ? `Ordering closes in ${shopStatus.minutesUntilClose} min`
                : 'This merchant is currently closed'}
            </p>
            <p className={`text-xs mt-0.5 ${shopStatus.closingSoon ? 'text-orange-700' : 'text-muted-foreground'}`}>
              {shopStatus.closingSoon
                ? 'Last orders are not being accepted. Browse the catalogue for next time!'
                : `You can browse products but orders are paused.${shop.opening_hours ? ` Hours: ${formatOpeningHours(shop.opening_hours)}` : ''}`}
            </p>
          </div>
        </div>
      )}

      {/* Product catalogue (same layout for all merchant types) */}
      <div className="px-4 mt-6">
        <h2 className="text-lg font-bold text-foreground mb-3">Products</h2>
        {menuError ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">Could not load products. {menuLoadError?.message}</p>
          </div>
        ) : menuLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-muted-foreground text-sm">Catalogue coming soon</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {category}
                </h3>
                <div className="space-y-2.5">
                  {items.map((item) => (
                    <MenuItemCard key={item.id} item={item} shop={shop} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ShopPromotions shopId={shopId} />
      <ShopReviews shopId={shopId} />
    </div>
  );
}
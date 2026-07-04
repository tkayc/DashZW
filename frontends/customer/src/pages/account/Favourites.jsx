import React, { useMemo, useState } from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { getFavourites, toggleMerchantFavourite, toggleProductFavourite } from '@/lib/favourites';
import { toast } from 'sonner';

/**
 * Favourites — localStorage mock; sync to API later.
 * TODO(postgresql): customer_favourites (user_id, merchant_id | product_id).
 */
export default function Favourites() {
  const [tick, setTick] = useState(0);
  const favs = useMemo(() => getFavourites(), [tick]);

  const { data: shops = [] } = useQuery({
    queryKey: ['shops'],
    queryFn: () => base44.entities.Shop.list('-created_date', 100),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['all-products'],
    queryFn: () => base44.entities.MenuItem.list('-created_date', 200),
  });

  const favMerchants = shops.filter((s) => favs.merchants.includes(s.id));
  const favProducts = products.filter((p) => favs.products.includes(p.id));

  const refresh = () => setTick((t) => t + 1);

  return (
    <div className="px-4 pt-6 pb-8">
      <PageHeader title="Favourites" subtitle="Saved merchants & products" />

      {favMerchants.length === 0 && favProducts.length === 0 && (
        <div className="bg-muted/40 rounded-2xl p-8 text-center">
          <Heart className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="font-semibold text-foreground">No favourites yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tap the heart on a merchant or product page to save it here.
          </p>
          <Link to="/explore" className="inline-block mt-4 text-sm font-semibold text-primary">
            Explore merchants
          </Link>
        </div>
      )}

      {favMerchants.length > 0 && (
        <section className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Merchants
          </p>
          <div className="space-y-2">
            {favMerchants.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 bg-card border border-border/50 rounded-2xl p-3"
              >
                <Link to={`/shop/${s.id}`} className="flex-1 min-w-0 flex items-center gap-3">
                  <img
                    src={s.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=100&q=80'}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.category}</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    toggleMerchantFavourite(s.id);
                    refresh();
                    toast.success('Removed');
                  }}
                >
                  <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {favProducts.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Products
          </p>
          <div className="space-y-2">
            {favProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 bg-card border border-border/50 rounded-2xl p-3"
              >
                <Link
                  to={`/shop/${p.shop_id}/product/${p.id}`}
                  className="flex-1 min-w-0"
                >
                  <p className="font-semibold text-sm truncate">{p.name}</p>
                  <p className="text-xs text-primary font-bold">{formatUSD(p.price)}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    toggleProductFavourite(p.id);
                    refresh();
                    toast.success('Removed');
                  }}
                >
                  <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

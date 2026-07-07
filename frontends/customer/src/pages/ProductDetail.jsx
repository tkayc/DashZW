import React, { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart, Share2, Clock, Package, Plus, Minus, Check } from 'lucide-react';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/lib/CartContext';
import { getShopStatus } from '@/api';
import { getMerchantCategory } from '@/domain/merchantCategories';
import {
  getMockVariants,
  getMockAddons,
  getMockPrepMinutes,
  getStockStatus,
  getMockNutrition,
  getMockAllergens,
  getMockProductReviews,
  getMockProductImages,
} from '@/lib/productExtras';
import {
  isProductFavourite,
  toggleProductFavourite,
} from '@/lib/favourites';
import { getApiBaseUrl } from '@/api';
import { formatUSD } from '@/lib/formatCurrency';

/**
 * Product detail — variants, add-ons, stock, prep time, favourites, share, related.
 * TODO(postgresql): Load variants/addons/stock from product catalog tables.
 */
export default function ProductDetail() {
  const { shopId, productId } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [variantId, setVariantId] = useState(null);
  const [addonIds, setAddonIds] = useState([]);
  const [qty, setQty] = useState(1);
  const [fav, setFav] = useState(() => isProductFavourite(productId));
  const [imageIdx, setImageIdx] = useState(0);

  const { data: shop } = useQuery({
    queryKey: ['shop', shopId],
    queryFn: async () => (await base44.entities.Shop.filter({ id: shopId }))[0],
    enabled: !!shopId,
  });

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const items = await base44.entities.MenuItem.filter({ id: productId });
      return items[0];
    },
    enabled: !!productId,
  });

  const { data: related = [] } = useQuery({
    queryKey: ['related', shopId, productId],
    queryFn: async () => {
      const items = await base44.entities.MenuItem.filter({ shop_id: shopId });
      return items.filter((i) => i.id !== productId).slice(0, 4);
    },
    enabled: !!shopId && !!productId,
  });

  const variants = useMemo(() => {
    if (!product) return [];
    if (product.variants?.length) return product.variants.filter((v) => v.is_available !== false);
    return getMockVariants(product, shop?.category);
  }, [product, shop?.category]);

  const addons = useMemo(() => {
    if (!product) return [];
    if (product.addons?.length) return product.addons.filter((a) => a.is_available !== false);
    return getMockAddons(product, shop?.category);
  }, [product, shop?.category]);

  const selectedVariant = variants.find((v) => v.id === (variantId || variants[0]?.id)) || variants[0];
  const selectedAddons = addons.filter((a) => addonIds.includes(a.id));

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const base = product.price + (selectedVariant?.priceDelta || 0);
    const add = selectedAddons.reduce((s, a) => s + a.price, 0);
    return base + add;
  }, [product, selectedVariant, selectedAddons]);

  const stock = product ? getStockStatus(product) : { inStock: true, label: '' };
  const prepMins = getMockPrepMinutes(shop?.category);
  const nutrition = product ? getMockNutrition(product) : null;
  const allergens = product ? getMockAllergens(product, shop?.category) : [];
  const reviews = product ? getMockProductReviews(product.id) : [];
  const images = useMemo(() => {
    if (!product) return [];
    const urls = product.image_urls?.length ? product.image_urls : product.image_url ? [product.image_url] : [];
    if (urls.length) {
      return urls.map((url, i) => ({
        id: `img_${i}`,
        url: url.startsWith('http') || url.startsWith('data:') ? url : `${getApiBaseUrl()}${url}`,
      }));
    }
    return getMockProductImages(product);
  }, [product]);
  const cat = getMerchantCategory(shop?.category);
  const shopStatus = shop ? getShopStatus(shop) : { isOpen: true };
  const canOrder = shopStatus.isOpen && stock.inStock;

  const toggleAddon = (id) => {
    setAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleFavourite = () => {
    const on = toggleProductFavourite(productId);
    setFav(on);
    toast.success(on ? 'Saved to favourites' : 'Removed from favourites');
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product?.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      toast.message('Share cancelled');
    }
    // TODO(backend): Track share events for analytics
  };

  const handleAdd = () => {
    if (!product || !shop) return;
    const result = addItem(
      {
        menu_item_id: product.id,
        name: product.name,
        price: unitPrice,
        image_url: product.image_url,
        quantity: qty,
        variant_id: selectedVariant?.id,
        variant_name: selectedVariant?.name,
        addon_ids: selectedAddons.map((a) => a.id),
        addon_names: selectedAddons.map((a) => a.name),
      },
      shop
    );
    if (result === 'switched') {
      toast.info('Cart cleared — items from a different merchant were removed');
    } else {
      toast.success('Added to cart');
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-muted" />
        <div className="p-4 space-y-3">
          <div className="h-6 w-48 bg-muted rounded-lg" />
          <div className="h-4 w-full bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-20 px-4">
        <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
        <p className="font-semibold text-foreground">Product not found</p>
        <p className="text-sm text-muted-foreground mt-1">This item may no longer be available.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  const heroSrc = images[imageIdx]?.url || product.image_url;

  return (
    <div className="pb-8">
      <div className="relative h-64 bg-muted">
        {heroSrc ? (
          <img
            src={heroSrc}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16 text-muted-foreground/40" />
          </div>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setImageIdx(i)}
                className={`w-2 h-2 rounded-full ${i === imageIdx ? 'bg-white' : 'bg-white/50'}`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-background/90 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            type="button"
            onClick={handleFavourite}
            className="w-9 h-9 rounded-full bg-background/90 flex items-center justify-center"
          >
            <Heart className={`w-4 h-4 ${fav ? 'fill-red-500 text-red-500' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="w-9 h-9 rounded-full bg-background/90 flex items-center justify-center"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-foreground">{product.name}</h1>
            <p className="text-lg font-bold text-primary shrink-0">{formatUSD(unitPrice)}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {cat?.label} ·{' '}
            <Link to={`/shop/${shopId}`} className="text-primary font-medium">
              {shop?.name}
            </Link>
          </p>
          {product.description && (
            <p className="text-sm text-muted-foreground mt-2">{product.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            className={
              stock.inStock
                ? stock.low
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }
          >
            {stock.label}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" /> ~{prepMins} min prep
          </Badge>
          {product.is_popular && <Badge className="bg-accent/15 text-accent">Popular</Badge>}
        </div>

        {variants.length > 0 && (
          <section>
            <p className="text-sm font-semibold text-foreground mb-2">Options</p>
            <div className="space-y-2">
              {variants.map((v) => {
                const selected = (variantId || variants[0]?.id) === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${
                      selected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    <span className="text-sm font-medium">{v.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {v.priceDelta > 0 ? `+${formatUSD(v.priceDelta)}` : 'Included'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {addons.length > 0 && (
          <section>
            <p className="text-sm font-semibold text-foreground mb-2">Add-ons</p>
            <div className="space-y-2">
              {addons.map((a) => {
                const on = addonIds.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAddon(a.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left ${
                      on ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                          on ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                        }`}
                      >
                        {on && <Check className="w-3 h-3" />}
                      </span>
                      {a.name}
                    </span>
                    <span className="text-xs text-muted-foreground">+{formatUSD(a.price)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Nutrition placeholder */}
        {nutrition && (
          <section className="bg-muted/40 rounded-2xl p-4 border border-border/40">
            <p className="text-sm font-semibold text-foreground mb-2">Nutrition</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ['Cal', nutrition.calories],
                ['Protein', `${nutrition.protein_g}g`],
                ['Carbs', `${nutrition.carbs_g}g`],
                ['Fat', `${nutrition.fat_g}g`],
              ].map(([label, val]) => (
                <div key={label} className="bg-card rounded-xl py-2 px-1">
                  <p className="text-sm font-bold text-foreground">{val}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">{nutrition.note}</p>
            {/* TODO(postgresql): product_nutrition */}
          </section>
        )}

        {/* Allergens placeholder */}
        {allergens.length > 0 && (
          <section>
            <p className="text-sm font-semibold text-foreground mb-2">Allergens</p>
            <div className="flex flex-wrap gap-1.5">
              {allergens.map((a) => (
                <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              Always check packaging. Placeholder data only.
            </p>
          </section>
        )}

        {/* Reviews */}
        <section>
          <p className="text-sm font-semibold text-foreground mb-2">Reviews</p>
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className="bg-card border border-border/50 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{r.name}</p>
                  <span className="text-xs text-amber-600 font-semibold">{'★'.repeat(r.rating)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{r.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{r.date}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3 bg-muted rounded-xl px-2 py-1">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-card flex items-center justify-center"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold w-6 text-center">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="w-8 h-8 rounded-lg bg-card flex items-center justify-center"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <Button
            disabled={!canOrder}
            onClick={handleAdd}
            className="flex-1 h-12 rounded-2xl font-semibold"
          >
            Add · {formatUSD((unitPrice * qty))}
          </Button>
        </div>

        {related.length > 0 && (
          <section className="pt-2">
            <p className="text-sm font-semibold text-foreground mb-2">Related products</p>
            <div className="grid grid-cols-2 gap-2">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/shop/${shopId}/product/${r.id}`}
                  className="bg-card border border-border/50 rounded-2xl p-3 hover:bg-muted/40"
                >
                  <p className="text-sm font-semibold line-clamp-1">{r.name}</p>
                  <p className="text-xs text-primary font-bold mt-1">{formatUSD(r.price)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

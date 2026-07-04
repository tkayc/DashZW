import React, { useState, useEffect, useMemo } from 'react';
import { formatUSD, formatUSDSigned } from '@/lib/formatCurrency';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X, Package, ArrowLeft, Tag, SlidersHorizontal } from 'lucide-react';
import { base44 } from '@/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getShopStatus } from '@/api';
import { MERCHANT_CATEGORIES, getMerchantCategory } from '@/domain/merchantCategories';

const SORTS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'rating', label: 'Rating' },
  { id: 'delivery_time', label: 'Delivery time' },
  { id: 'name', label: 'Name' },
];

/**
 * Grouped search + filters/sort (mock distance/fee).
 * TODO(postgresql): Full-text search + geo filters.
 */
export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [merchants, setMerchants] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState('relevance');
  const [filters, setFilters] = useState({
    openNow: false,
    minRating: 0,
    merchantType: 'all',
    maxDeliveryFee: 99,
    maxDeliveryTime: 99,
    maxPrice: 999,
    maxDistance: 99,
  });

  useEffect(() => {
    if (!query.trim()) {
      setMerchants([]);
      setProducts([]);
      setCategories([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [allShops, allItems] = await Promise.all([
          base44.entities.Shop.list('-created_date', 100),
          base44.entities.MenuItem.filter({ is_available: true }, '-created_date', 500),
        ]);
        const q = query.toLowerCase();

        let shops = allShops.filter(
          (s) =>
            s.approval_status !== 'rejected' &&
            (s.name?.toLowerCase().includes(q) ||
              s.category?.toLowerCase().includes(q) ||
              s.description?.toLowerCase().includes(q))
        );

        // Filters (mock distance/fee/time)
        shops = shops.filter((s) => {
          const { isOpen } = getShopStatus(s);
          if (filters.openNow && !isOpen) return false;
          if (filters.minRating && (s.rating || 0) < filters.minRating) return false;
          if (filters.merchantType !== 'all' && s.category !== filters.merchantType) return false;
          // Mock delivery fee / time / distance from rating seed
          const mockFee = 1 + (5 - (s.rating || 4));
          const mockTime = parseInt(s.estimated_delivery_time, 10) || 30;
          const mockDist = 2 + (5 - (s.rating || 4));
          if (mockFee > filters.maxDeliveryFee) return false;
          if (mockTime > filters.maxDeliveryTime) return false;
          if (mockDist > filters.maxDistance) return false;
          return true;
        });

        if (sort === 'rating') shops.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        if (sort === 'name') shops.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (sort === 'delivery_time') {
          shops.sort(
            (a, b) =>
              (parseInt(a.estimated_delivery_time, 10) || 40) -
              (parseInt(b.estimated_delivery_time, 10) || 40)
          );
        }

        setMerchants(shops.slice(0, 8));

        let items = allItems.filter(
          (i) =>
            i.name?.toLowerCase().includes(q) ||
            i.description?.toLowerCase().includes(q) ||
            i.category?.toLowerCase().includes(q)
        );
        if (filters.maxPrice < 999) {
          items = items.filter((i) => (i.price || 0) <= filters.maxPrice);
        }
        setProducts(items.slice(0, 10));

        setCategories(
          MERCHANT_CATEGORIES.filter(
            (c) => c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
          ).slice(0, 6)
        );
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, filters, sort]);

  const hasResults = merchants.length > 0 || products.length > 0 || categories.length > 0;
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.openNow) n++;
    if (filters.minRating > 0) n++;
    if (filters.merchantType !== 'all') n++;
    if (filters.maxDeliveryFee < 99) n++;
    if (filters.maxDeliveryTime < 99) n++;
    if (filters.maxPrice < 999) n++;
    if (filters.maxDistance < 99) n++;
    return n;
  }, [filters]);

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Merchants, products, categories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-9 rounded-2xl bg-muted/60 border-0 h-11"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="relative w-10 h-10 rounded-xl bg-muted flex items-center justify-center"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="bg-card border border-border rounded-2xl p-4 mb-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Filters & sort</p>
          <div className="flex flex-wrap gap-2">
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  sort === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={filters.openNow}
              onChange={(e) => setFilters((f) => ({ ...f, openNow: e.target.checked }))}
            />
            Open now
          </label>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Min rating: {filters.minRating || 'Any'}</p>
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={filters.minRating}
              onChange={(e) => setFilters((f) => ({ ...f, minRating: parseFloat(e.target.value) }))}
              className="w-full"
            />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Merchant type</p>
            <select
              value={filters.merchantType}
              onChange={(e) => setFilters((f) => ({ ...f, merchantType: e.target.value }))}
              className="w-full rounded-xl bg-muted/50 border-0 text-sm px-3 py-2"
            >
              <option value="all">All types</option>
              {MERCHANT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[10px] text-muted-foreground">
            <label>
              Max delivery fee {formatUSD(filters.maxDeliveryFee >= 99 ? '∞' : filters.maxDeliveryFee)}
              <input
                type="range"
                min="1"
                max="99"
                value={filters.maxDeliveryFee}
                onChange={(e) => setFilters((f) => ({ ...f, maxDeliveryFee: parseInt(e.target.value, 10) }))}
                className="w-full"
              />
            </label>
            <label>
              Max time {filters.maxDeliveryTime >= 99 ? '∞' : `${filters.maxDeliveryTime}m`}
              <input
                type="range"
                min="10"
                max="99"
                value={filters.maxDeliveryTime}
                onChange={(e) => setFilters((f) => ({ ...f, maxDeliveryTime: parseInt(e.target.value, 10) }))}
                className="w-full"
              />
            </label>
            <label>
              Max price {formatUSD(filters.maxPrice >= 999 ? '∞' : filters.maxPrice)}
              <input
                type="range"
                min="20"
                max="999"
                value={filters.maxPrice}
                onChange={(e) => setFilters((f) => ({ ...f, maxPrice: parseInt(e.target.value, 10) }))}
                className="w-full"
              />
            </label>
            <label>
              Max distance {filters.maxDistance >= 99 ? '∞' : `${filters.maxDistance}km`}
              <input
                type="range"
                min="1"
                max="99"
                value={filters.maxDistance}
                onChange={(e) => setFilters((f) => ({ ...f, maxDistance: parseInt(e.target.value, 10) }))}
                className="w-full"
              />
            </label>
          </div>
          <button
            type="button"
            className="text-xs text-primary font-semibold"
            onClick={() =>
              setFilters({
                openNow: false,
                minRating: 0,
                merchantType: 'all',
                maxDeliveryFee: 99,
                maxDeliveryTime: 99,
                maxPrice: 999,
                maxDistance: 99,
              })
            }
          >
            Reset filters
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && query && !hasResults && (
        <div className="text-center py-16">
          <p className="font-semibold text-foreground">No results for &quot;{query}&quot;</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting filters</p>
        </div>
      )}

      {!loading && !query && (
        <div className="text-center py-16">
          <SearchIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-foreground">Search for anything</p>
          <p className="text-sm text-muted-foreground mt-1">Merchants, products, categories…</p>
        </div>
      )}

      {!loading && hasResults && (
        <div className="space-y-6">
          {categories.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Categories
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => navigate(`/explore?category=${cat.id}`)}
                    className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-2 text-sm font-medium"
                  >
                    <span>{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {merchants.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Merchants</p>
              <div className="space-y-2">
                {merchants.map((shop) => {
                  const { isOpen } = getShopStatus(shop);
                  const cat = getMerchantCategory(shop.category);
                  return (
                    <button
                      key={shop.id}
                      type="button"
                      onClick={() => navigate(`/shop/${shop.id}`)}
                      className="w-full flex items-center gap-3 bg-card rounded-2xl p-3 border border-border text-left"
                    >
                      <img
                        src={shop.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&q=80'}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{shop.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cat?.label} · ★ {shop.rating?.toFixed(1)} · {shop.estimated_delivery_time}
                        </p>
                      </div>
                      <Badge className={isOpen ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}>
                        {isOpen ? 'Open' : 'Closed'}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {products.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Products</p>
              <div className="space-y-2">
                {products.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/shop/${item.shop_id}/product/${item.id}`)}
                    className="w-full flex items-center gap-3 bg-card rounded-2xl p-3 border border-border text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{item.category}</p>
                    </div>
                    <p className="font-bold text-sm text-primary">{formatUSD(item.price)}</p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

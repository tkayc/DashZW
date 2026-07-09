import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRealtimeQuery as useQuery } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { useDeliveryLocation } from '@/lib/LocationContext';
import { locationApi } from '@/api/location';
import HeroBanner from '@/components/home/HeroBanner';
import CategoryScroll from '@/components/home/CategoryScroll';
import MerchantRail from '@/components/home/MerchantRail';
import { SHOP_DEAL_ADS } from '@/domain/promotions';
import { getRecentlyViewedIds } from '@/lib/recentlyViewed';
import { isActiveOrderStatus } from '@/domain/orderStates';
import { base44 } from '@/api';

const normalizeCategoryKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

export default function Home() {
  const { user, isGuest } = useAuth();
  const { delivery, sort, setSort, sortOptions } = useDeliveryLocation();
  const [activeCategory, setActiveCategory] = useState(null);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const { data: merchants = [], isLoading } = useQuery({
    queryKey: ['merchants-discover', delivery?.lat, delivery?.lng, sort, activeCategory],
    queryFn: () =>
      delivery?.lat != null
        ? locationApi.discoverMerchants({ lat: delivery.lat, lng: delivery.lng, sort })
        : base44.entities.Shop.list('-created_date', 50).then((shops) =>
            shops.filter((s) => s.approval_status !== 'rejected').map((s) => ({ ...s, distance_km: null }))
          ),
    enabled: true,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['myOrders-home', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user.email }, '-created_date', 20),
    enabled: !!user?.email && !isGuest,
  });

  const filtered = useMemo(() => {
    const list = merchants.filter((s) => s.approval_status !== 'rejected');
    if (!activeCategory) return list;
    const selected = normalizeCategoryKey(activeCategory);
    return list.filter((s) => normalizeCategoryKey(s.category_id || s.category) === selected);
  }, [merchants, activeCategory]);

  const byRating = [...filtered].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const featured = filtered.slice(0, 6);
  const popular = byRating.slice(0, 6);
  const topRated = byRating.filter((s) => (s.rating || 0) >= 4.5).slice(0, 6);
  const trending = [...filtered].reverse().slice(0, 6);
  const newMerchants = [...filtered]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 6);
  const nearby = filtered.slice(0, 8);
  const recommended = byRating.slice(1, 7);

  const recentIds = getRecentlyViewedIds();
  const recentlyViewed = recentIds.map((id) => filtered.find((s) => s.id === id)).filter(Boolean).slice(0, 6);

  const reorderMerchants = useMemo(() => {
    const ids = [];
    for (const o of orders) {
      const id = o.merchant_id || o.shop_id;
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids.map((id) => filtered.find((s) => s.id === id)).filter(Boolean).slice(0, 6);
  }, [orders, filtered]);

  const activeOrders = orders.filter((o) => isActiveOrderStatus(o.status)).slice(0, 2);

  return (
    <div className="pb-4 space-y-1">
      <div className="px-4 pt-2">
        <p className="text-sm text-muted-foreground">{greeting}</p>
        <h1 className="text-xl font-bold text-foreground">
          {isGuest ? 'Welcome, guest' : user?.full_name?.split(' ')[0] || 'Welcome'}
        </h1>
      </div>

      <div className="px-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {sortOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSort(opt.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              sort === opt.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <HeroBanner ads={SHOP_DEAL_ADS} />
      <CategoryScroll activeCategory={activeCategory} onCategorySelect={setActiveCategory} />

      {activeOrders.length > 0 && (
        <div className="px-4 mt-4">
          <h2 className="text-sm font-bold text-foreground mb-2">Active orders</h2>
          <div className="space-y-2">
            {activeOrders.map((o) => (
              <Link key={o.id} to={`/order/${o.id}`} className="block bg-card border border-border rounded-2xl p-3">
                <p className="font-semibold text-sm">{o.shop_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{o.status?.replace(/_/g, ' ')}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <MerchantRail title="Nearby" shops={nearby} isLoading={isLoading} seeAllTo="/explore" />
      <MerchantRail title="Featured" shops={featured} isLoading={isLoading} seeAllTo="/explore" />
      <MerchantRail title="Top rated" shops={topRated} isLoading={isLoading} seeAllTo="/explore" />
      <MerchantRail title="Popular" shops={popular} isLoading={isLoading} seeAllTo="/explore" />
      {recentlyViewed.length > 0 && (
        <MerchantRail title="Recently viewed" shops={recentlyViewed} isLoading={false} seeAllTo={null} />
      )}
      {reorderMerchants.length > 0 && (
        <MerchantRail title="Order again" shops={reorderMerchants} isLoading={false} seeAllTo={null} />
      )}
      <MerchantRail title="New on DashZW" shops={newMerchants} isLoading={isLoading} seeAllTo="/explore" />
      <MerchantRail title="Trending" shops={trending} isLoading={isLoading} seeAllTo="/explore" />
      <MerchantRail title="Recommended" shops={recommended} isLoading={isLoading} seeAllTo="/explore" />
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import HeroBanner from '@/components/home/HeroBanner';
import CategoryScroll from '@/components/home/CategoryScroll';
import MerchantRail from '@/components/home/MerchantRail';
import { MOCK_DEALS } from '@/domain/promotions';
import { getRecentlyViewedIds } from '@/lib/recentlyViewed';
import { isActiveOrderStatus } from '@/domain/orderStates';

/**
 * Customer home — greeting + discovery rails (mock ranking).
 * TODO(postgresql): Personalisation queries for recommended / trending.
 */
export default function Home() {
  const { user, isGuest } = useAuth();
  const [activeCategory, setActiveCategory] = useState(null);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['shops'],
    queryFn: () => base44.entities.Shop.list('-created_date', 50),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['myOrders-home', user?.email],
    queryFn: () => base44.entities.Order.filter({ customer_email: user.email }, '-created_date', 20),
    enabled: !!user?.email && !isGuest,
  });

  const approved = useMemo(
    () => shops.filter((s) => s.approval_status !== 'rejected'),
    [shops]
  );

  const filtered = activeCategory
    ? approved.filter((s) => s.category === activeCategory)
    : approved;

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
  const recentlyViewed = recentIds
    .map((id) => approved.find((s) => s.id === id))
    .filter(Boolean)
    .slice(0, 6);

  const reorderMerchants = useMemo(() => {
    const ids = [];
    for (const o of orders) {
      const id = o.merchant_id || o.shop_id;
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids.map((id) => approved.find((s) => s.id === id)).filter(Boolean).slice(0, 6);
  }, [orders, approved]);

  const activeOrders = orders.filter((o) => isActiveOrderStatus(o.status)).slice(0, 2);

  return (
    <div className="pb-4 space-y-1">
      <div className="px-4 pt-4">
        <p className="text-sm text-muted-foreground">{greeting}</p>
        <h1 className="text-xl font-bold text-foreground">
          {isGuest ? 'Welcome, guest' : user?.full_name?.split(' ')[0] || 'Welcome'}
        </h1>
      </div>

      {activeOrders.length > 0 && (
        <div className="px-4 mt-3 space-y-2">
          {activeOrders.map((o) => (
            <Link
              key={o.id}
              to={`/order/${o.id}`}
              className="block bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3"
            >
              <p className="text-xs font-semibold text-primary">Active order</p>
              <p className="text-sm font-bold text-foreground">
                {o.merchant_name || o.shop_name}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {(o.status || '').replace(/_/g, ' ')}
              </p>
            </Link>
          ))}
        </div>
      )}

      <HeroBanner />
      <CategoryScroll onCategorySelect={setActiveCategory} activeCategory={activeCategory} />

      {/* Deals */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground">Deals</h2>
          <Link to="/deals" className="text-xs font-semibold text-primary">
            See all
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {MOCK_DEALS.map((d) => (
            <Link
              key={d.id}
              to="/deals"
              className="min-w-[200px] bg-card border border-border/50 rounded-2xl p-4 hover:bg-muted/30"
            >
              <span className="text-2xl">{d.emoji}</span>
              <p className="font-semibold text-sm mt-2">{d.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{d.body}</p>
              <span className="text-[10px] font-semibold text-primary mt-2 inline-block">{d.badge}</span>
            </Link>
          ))}
        </div>
      </div>

      <MerchantRail title="Nearby" shops={nearby} isLoading={isLoading} />
      <MerchantRail title="Featured" shops={featured} isLoading={isLoading} />
      <MerchantRail title="Popular" shops={popular} isLoading={isLoading} />
      <MerchantRail
        title="Recommended"
        shops={recommended}
        isLoading={isLoading}
        seeAllTo="/recommendations"
      />
      <MerchantRail
        title="Recently viewed"
        shops={recentlyViewed}
        isLoading={false}
        seeAllTo={null}
        emptyLabel={recentlyViewed.length === 0 ? 'Merchants you open will show up here.' : undefined}
      />
      <MerchantRail
        title="Reorder"
        shops={reorderMerchants}
        isLoading={false}
        seeAllTo="/orders"
        emptyLabel={!user ? 'Sign in to see past merchants.' : reorderMerchants.length === 0 ? 'Your past merchants appear here.' : undefined}
      />
      <MerchantRail title="Trending" shops={trending} isLoading={isLoading} />
      <MerchantRail title="Top rated" shops={topRated} isLoading={isLoading} />
      <MerchantRail title="New merchants" shops={newMerchants} isLoading={isLoading} />
    </div>
  );
}

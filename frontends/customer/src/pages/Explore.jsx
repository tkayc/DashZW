import React, { useState } from 'react';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import ShopCard from '@/components/shared/ShopCard';
import PageHeader from '@/components/layout/PageHeader';
import { MERCHANT_CATEGORIES } from '@/domain/merchantCategories';
import CategoryIcon from '@shared/components/CategoryIcon.jsx';

/**
 * Browse merchants by category — complements Home and Search.
 */
export default function Explore() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category') || 'all';

  const [activeCategory, setActiveCategory] = useState(initialCategory);

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['shops'],
    queryFn: () => base44.entities.Shop.list('-created_date', 50),
  });

  const filtered = shops.filter((shop) => {
    if (shop.approval_status === 'rejected') return false;
    return activeCategory === 'all' || shop.category === activeCategory;
  });

  const chips = [{ id: 'all', label: 'All', icon: '📦' }, ...MERCHANT_CATEGORIES];

  return (
    <div className="px-4 pt-6 pb-4">
      <PageHeader title="Explore" subtitle="Browse merchants by category" />

      <div className="flex gap-2 overflow-x-auto pb-3 mb-2" style={{ scrollbarWidth: 'none' }}>
        {chips.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <CategoryIcon category={cat.id === 'all' ? null : cat} emoji={cat.icon} size={16} />
            {cat.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-semibold text-foreground">No merchants found</p>
          <p className="text-sm text-muted-foreground mt-1">Try another category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </div>
  );
}

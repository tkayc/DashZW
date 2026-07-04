import React, { useState } from 'react';
import { base44 } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import ShopCard from '@/components/shared/ShopCard';
import PageHeader from '@/components/layout/PageHeader';
import { MERCHANT_CATEGORIES } from '@/domain/merchantCategories';

/**
 * Browse merchants by category — complements Home and Search.
 */
export default function Explore() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category') || 'all';

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(initialCategory);

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['shops'],
    queryFn: () => base44.entities.Shop.list('-created_date', 50),
  });

  const filtered = shops.filter((shop) => {
    if (shop.approval_status === 'rejected') return false;
    const matchesSearch = !search || shop.name?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || shop.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const chips = [{ id: 'all', label: 'All', icon: '📦' }, ...MERCHANT_CATEGORIES];

  return (
    <div className="px-4 pt-6 pb-4">
      <PageHeader title="Explore" subtitle="Browse merchants by category" />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search merchants…"
          className="pl-9 rounded-xl bg-muted/50 border-0"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-2" style={{ scrollbarWidth: 'none' }}>
        {chips.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              activeCategory === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {cat.icon ? `${cat.icon} ` : ''}
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
          <p className="text-sm text-muted-foreground mt-1">Try another category or search</p>
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

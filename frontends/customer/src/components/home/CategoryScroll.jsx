import React from 'react';
import { MERCHANT_CATEGORIES } from '@/domain/merchantCategories';
import CategoryIcon from '@shared/components/CategoryIcon.jsx';

export default function CategoryScroll({
  onCategorySelect,
  activeCategory,
  // Backward-compat for older callers.
  onSelect,
  active,
}) {
  const selectedCategory = activeCategory ?? active ?? null;
  const handleSelect = onCategorySelect || onSelect;

  return (
    <div className="px-4 mt-4">
      <h2 className="text-base font-bold text-foreground mb-3">Categories</h2>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        <button
          type="button"
          onClick={() => handleSelect?.(null)}
          className={`flex flex-col items-center gap-1.5 min-w-[64px] shrink-0 ${!selectedCategory ? 'opacity-100' : 'opacity-60'}`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-all ${
              !selectedCategory ? 'bg-primary/15 ring-2 ring-primary scale-105' : 'bg-secondary'
            }`}
          >
            <CategoryIcon emoji="📦" size={30} />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">All</span>
        </button>

        {MERCHANT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleSelect?.(cat.id)}
            className={`flex flex-col items-center gap-1.5 min-w-[64px] shrink-0 transition-opacity ${
              selectedCategory && selectedCategory !== cat.id ? 'opacity-50' : 'opacity-100'
            }`}
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm transition-all ${
                selectedCategory === cat.id ? 'bg-primary/15 ring-2 ring-primary scale-105' : 'bg-secondary'
              }`}
            >
              <CategoryIcon category={cat} size={30} />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight">
              {cat.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

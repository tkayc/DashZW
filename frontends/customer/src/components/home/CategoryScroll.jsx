import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { MERCHANT_CATEGORIES } from '@/domain/merchantCategories';

export default function CategoryScroll({ onCategorySelect, activeCategory }) {
  const navigate = useNavigate();

  return (
    <div className="px-4 mt-5">
      <button
        onClick={() => navigate('/search')}
        className="w-full flex items-center gap-3 bg-muted/60 rounded-2xl px-4 py-3 mb-4 text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="w-4 h-4 shrink-0" />
        <span className="text-sm">Search merchants or products…</span>
      </button>

      <h2 className="text-base font-bold text-foreground mb-3">Categories</h2>
      <div className="flex gap-2.5 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => onCategorySelect?.(null)}
          className={`flex flex-col items-center gap-1.5 min-w-[64px] shrink-0 ${!activeCategory ? 'opacity-100' : 'opacity-60'}`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-all ${
              !activeCategory ? 'bg-primary text-primary-foreground scale-105' : 'bg-secondary'
            }`}
          >
            📦
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">All</span>
        </button>

        {MERCHANT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategorySelect?.(cat.id)}
            className={`flex flex-col items-center gap-1.5 min-w-[64px] shrink-0 transition-opacity ${
              activeCategory && activeCategory !== cat.id ? 'opacity-50' : 'opacity-100'
            }`}
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-all ${
                activeCategory === cat.id ? 'bg-primary text-primary-foreground scale-105' : 'bg-secondary'
              }`}
            >
              {cat.icon}
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

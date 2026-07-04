import React, { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';

const LANG_KEY = 'dashzw_language';
const OPTIONS = [
  { id: 'en', label: 'English' },
  { id: 'sn', label: 'Shona' },
  { id: 'nd', label: 'Ndebele' },
];

/** TODO(i18n): Wire react-i18next / locale packs. */
export default function Language() {
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || 'en');

  return (
    <div className="px-4 pt-6 pb-8">
      <PageHeader title="Language" subtitle="App display language" />
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        {OPTIONS.map((opt, i) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              setLang(opt.id);
              localStorage.setItem(LANG_KEY, opt.id);
            }}
            className={`w-full flex items-center justify-between p-4 text-left ${
              i > 0 ? 'border-t border-border/50' : ''
            } ${lang === opt.id ? 'bg-primary/5' : ''}`}
          >
            <span className="text-sm font-medium">{opt.label}</span>
            {lang === opt.id && <span className="text-xs font-semibold text-primary">Selected</span>}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 px-1">
        Preference is stored locally. Full translations will load from the backend later.
      </p>
    </div>
  );
}

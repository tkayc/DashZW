import React from 'react';
import { Construction } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';

/**
 * Placeholder shell for upcoming customer features.
 * Keeps layout consistent with the rest of the app.
 *
 * TODO(postgresql): Replace mock sections with live API data.
 */
export default function FeaturePlaceholder({
  title,
  subtitle,
  icon: Icon = Construction,
  description,
  bullets = [],
  mockCards = [],
  footerNote,
}) {
  return (
    <div className="px-4 pt-6 pb-8">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="bg-card rounded-2xl border border-border/50 p-5 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm text-foreground leading-relaxed">{description}</p>
        {bullets.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {bullets.map((b) => (
              <li key={b} className="text-xs text-muted-foreground flex gap-2">
                <span className="text-primary font-bold">·</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {mockCards.length > 0 && (
        <div className="space-y-3 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</p>
          {mockCards.map((card) => (
            <div
              key={card.id || card.title}
              className="bg-card rounded-2xl border border-border/50 p-4 flex items-start gap-3 opacity-90"
            >
              {card.emoji && <span className="text-2xl shrink-0">{card.emoji}</span>}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-foreground">{card.title}</p>
                {card.body && <p className="text-xs text-muted-foreground mt-0.5">{card.body}</p>}
                {card.meta && <p className="text-[10px] text-primary font-medium mt-1">{card.meta}</p>}
              </div>
              {card.badge && (
                <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-1 rounded-lg shrink-0">
                  {card.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
        <p className="text-xs text-amber-800 font-medium">Coming soon</p>
        <p className="text-[11px] text-amber-700 mt-0.5">
          {footerNote ||
            'This screen is a placeholder. Backend integration will be added later (PostgreSQL + APIs).'}
        </p>
      </div>
    </div>
  );
}

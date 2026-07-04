import React from 'react';
import PageHeader from '@/components/layout/PageHeader';

export default function About() {
  return (
    <div className="px-4 pt-6 pb-8">
      <PageHeader title="About DashZW" subtitle="Merchant delivery for everyone" />
      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-3 text-sm">
        <p className="font-bold text-foreground text-lg">DashZW</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          DashZW connects customers with local merchants — restaurants, grocery, pharmacy, and more — and
          independent drivers across Zimbabwe.
        </p>
        <p className="text-xs text-muted-foreground">Version 1.0.0 (customer)</p>
        <p className="text-xs text-muted-foreground">Made in Zimbabwe</p>
      </div>
    </div>
  );
}

import React from 'react';
import { Shield } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';

/** TODO(postgresql): Serve policy versions from CMS / legal_documents table. */
export default function PrivacyPolicy() {
  return (
    <div className="px-4 pt-6 pb-8">
      <PageHeader title="Privacy Policy" subtitle="How we handle your data" />
      <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4 text-sm text-foreground leading-relaxed">
        <p className="text-xs text-muted-foreground">Last updated: placeholder — not legal advice.</p>
        <section>
          <h2 className="font-bold mb-1">What we collect</h2>
          <p className="text-muted-foreground text-xs">
            Account details, delivery addresses, order history, device notifications preferences, and payment method
            selections (not full card numbers until a payment provider is integrated).
          </p>
        </section>
        <section>
          <h2 className="font-bold mb-1">How we use it</h2>
          <p className="text-muted-foreground text-xs">
            To fulfil orders, support delivery partners and merchants, improve recommendations, and send order updates
            you opt into.
          </p>
        </section>
        <section>
          <h2 className="font-bold mb-1">Your choices</h2>
          <p className="text-muted-foreground text-xs">
            You can request account deletion, export order history, and manage notification permissions from your device
            settings.
          </p>
        </section>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <p className="text-[11px] text-amber-800">
            Placeholder policy for product development. Replace with counsel-approved copy before production launch.
          </p>
        </div>
      </div>
    </div>
  );
}

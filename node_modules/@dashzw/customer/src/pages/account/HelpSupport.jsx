import React from 'react';
import { HelpCircle } from 'lucide-react';
import FeaturePlaceholder from '@/components/shared/FeaturePlaceholder';

/** TODO(postgresql): Support tickets table + messaging with support agents. */
export default function HelpSupport() {
  return (
    <FeaturePlaceholder
      title="Help & Support"
      subtitle="We're here for you"
      icon={HelpCircle}
      description="Get help with orders, refunds, account issues, and delivery problems. Live chat and ticket history will land here."
      bullets={[
        'Track open support tickets',
        'Report a missing or damaged item',
        'FAQ for payments, delivery, and refunds',
      ]}
      mockCards={[
        { id: 1, emoji: '📦', title: 'Order issues', body: 'Late, missing items, wrong order', badge: 'Soon' },
        { id: 2, emoji: '💳', title: 'Payments & refunds', body: 'Wallet, EcoCash, COD questions', badge: 'Soon' },
        { id: 3, emoji: '👤', title: 'Account help', body: 'Login, profile, notifications', badge: 'Soon' },
      ]}
    />
  );
}

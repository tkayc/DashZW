import React from 'react';
import { Gift } from 'lucide-react';
import FeaturePlaceholder from '@/components/shared/FeaturePlaceholder';

/** TODO(postgresql): gift_cards + gift_card_redemptions tables. */
export default function GiftCards() {
  return (
    <FeaturePlaceholder
      title="Gift cards"
      subtitle="Give DashZW credit"
      icon={Gift}
      description="Buy and redeem digital gift cards for friends and family. Balance will apply at checkout like wallet credit."
      bullets={['Send by email or SMS', 'Redeem codes to wallet', 'Corporate bulk purchase (later)']}
      mockCards={[
        { id: 1, emoji: '🎁', title: 'R100 Gift Card', body: 'Perfect for a quick lunch run', badge: 'Preview' },
        { id: 2, emoji: '🎁', title: 'R250 Gift Card', body: 'Great for weekly groceries', badge: 'Preview' },
      ]}
    />
  );
}

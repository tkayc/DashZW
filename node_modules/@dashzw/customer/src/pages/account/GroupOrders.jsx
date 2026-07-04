import React from 'react';
import { Users } from 'lucide-react';
import FeaturePlaceholder from '@/components/shared/FeaturePlaceholder';

/** TODO(postgresql): group_orders, group_order_participants, cart_shares tables. */
export default function GroupOrders() {
  return (
    <FeaturePlaceholder
      title="Group orders"
      subtitle="Order together, one delivery"
      icon={Users}
      description="Start a shared cart for the office or friends. Everyone adds items from the same merchant; one person checks out."
      bullets={[
        'Share a link or code',
        'Lock cart when host is ready',
        'Split payment options (later)',
      ]}
      mockCards={[
        { id: 1, emoji: '👥', title: 'Friday team lunch', body: '3 people · Mama\'s Kitchen', meta: 'Host: You', badge: 'Preview' },
      ]}
    />
  );
}

import React from 'react';
import { MapPinned } from 'lucide-react';
import FeaturePlaceholder from '@/components/shared/FeaturePlaceholder';

/**
 * Smart delivery instructions — saved addresses + gate codes / leave-at-door prefs.
 * Checkout already supports a free-text delivery note per order.
 *
 * TODO(postgresql): customer_addresses (label, lat/lng, instructions, is_default).
 */
export default function DeliveryInstructions() {
  return (
    <FeaturePlaceholder
      title="Delivery instructions"
      subtitle="Saved addresses & preferences"
      icon={MapPinned}
      description="Save home, work, and other addresses with smart instructions (gate code, leave at door, call on arrival) so checkout is faster."
      bullets={[
        'Multiple labelled addresses',
        'Default address for delivery mode',
        'Photo of entrance (later)',
      ]}
      mockCards={[
        { id: 1, emoji: '🏠', title: 'Home', body: 'Leave at security · Gate code 4421', meta: 'Default', badge: 'Preview' },
        { id: 2, emoji: '💼', title: 'Work', body: 'Reception, 3rd floor · Call on arrival', badge: 'Preview' },
      ]}
    />
  );
}

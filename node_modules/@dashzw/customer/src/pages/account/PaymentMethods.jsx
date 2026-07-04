import React from 'react';
import { CreditCard } from 'lucide-react';
import FeaturePlaceholder from '@/components/shared/FeaturePlaceholder';

/**
 * Saved payment methods (Uber Eats / DoorDash style).
 * Checkout already selects EcoCash / OneMoney / InnBucks / COD per order.
 *
 * TODO(postgresql): payment_methods table (user_id, provider, token, last4, is_default).
 * TODO(payments): Integrate EcoCash / card tokenization provider.
 */
export default function PaymentMethods() {
  return (
    <FeaturePlaceholder
      title="Payment methods"
      subtitle="Saved ways to pay"
      icon={CreditCard}
      description="Save EcoCash, OneMoney, InnBucks, or cards for one-tap checkout. Your current checkout flow still works without saved methods."
      bullets={[
        'Set a default payment method',
        'Secure tokens — we never store full card numbers in app code',
        'Remove methods anytime',
      ]}
      mockCards={[
        { id: 1, emoji: '📱', title: 'EcoCash', body: '•••• 7842', meta: 'Default', badge: 'Preview' },
        { id: 2, emoji: '💳', title: 'OneMoney', body: '•••• 3310', badge: 'Preview' },
        { id: 3, emoji: '💵', title: 'Cash on delivery', body: 'Pay the driver in cash', badge: 'Always available' },
      ]}
    />
  );
}

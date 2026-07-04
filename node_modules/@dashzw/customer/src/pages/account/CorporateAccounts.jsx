import React from 'react';
import { Building2 } from 'lucide-react';
import FeaturePlaceholder from '@/components/shared/FeaturePlaceholder';

/** TODO(postgresql): corporate_accounts, corporate_members, spend_limits tables. */
export default function CorporateAccounts() {
  return (
    <FeaturePlaceholder
      title="Corporate accounts"
      subtitle="Work meals & office supplies"
      icon={Building2}
      description="Join or create a company account with shared billing, spend limits, and expense reports — similar to Uber for Business."
      bullets={[
        'Invite teammates by email',
        'Monthly invoicing for admins',
        'Restrict categories (e.g. grocery only)',
      ]}
      mockCards={[
        { id: 1, emoji: '🏢', title: 'Acme Corp', body: 'Pending invite · Finance team', badge: 'Preview' },
      ]}
    />
  );
}

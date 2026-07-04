import React from 'react';
import { Lock } from 'lucide-react';
import FeaturePlaceholder from '@/components/shared/FeaturePlaceholder';

/** TODO(postgresql): password hashes, sessions, 2FA secrets. */
export default function Security() {
  return (
    <FeaturePlaceholder
      title="Security"
      subtitle="Password & account protection"
      icon={Lock}
      description="Change password, manage active sessions, and enable two-factor authentication when accounts move to PostgreSQL-backed auth."
      bullets={['Change password', 'Active sessions', 'Two-factor authentication (2FA)']}
      mockCards={[
        { id: 1, emoji: '🔑', title: 'Password', body: 'Last changed — unknown', badge: 'Soon' },
        { id: 2, emoji: '📱', title: '2FA', body: 'Not enabled', badge: 'Soon' },
      ]}
    />
  );
}

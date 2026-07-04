import React from 'react';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import PartnerDashboard from './PartnerDashboard';
import PartnerRegister from './PartnerRegister';

export default function PartnerIndex() {
  const { user } = useAuth();

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['partner-shop', user?.email],
    queryFn: () => base44.entities.Shop.filter({ owner_email: user.email }),
    enabled: !!user?.email,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const shop = shops[0];
  if (!shop) return <PartnerRegister />;
  return <PartnerDashboard shop={shop} />;
}
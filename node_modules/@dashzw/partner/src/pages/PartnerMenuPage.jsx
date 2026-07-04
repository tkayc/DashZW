import React from 'react';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import PartnerMenu from './PartnerMenu';
import { Link } from 'react-router-dom';

export default function PartnerMenuPage() {
  const { user } = useAuth();

  const { data: shops = [], isLoading } = useQuery({
    queryKey: ['partner-shop', user?.email],
    queryFn: () => base44.entities.Shop.filter({ owner_email: user.email }),
    enabled: !!user?.email,
  });

  if (isLoading) return <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mt-12" />;

  const shop = shops[0];
  if (!shop) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground mb-4">Register your shop first</p>
      <Link to="/" className="text-primary font-semibold">Go to Dashboard →</Link>
    </div>
  );

  return <PartnerMenu shop={shop} />;
}
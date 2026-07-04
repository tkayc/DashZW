import React from 'react';
import { useRealtimeQuery as useQuery } from '@/api';
import { base44 } from '@/api';
import { getCollectionSync } from '@/api';
import { Users, GitBranch, Star, Bell, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Lightweight merchant portal sections: staff, branches, reviews, customers, notifications.
 */
export default function PartnerSection({ shop, section }) {
  const { data: orders = [] } = useQuery({
    queryKey: ['partner-section-orders', shop?.id, section],
    queryFn: () => base44.entities.Order.filter({ shop_id: shop.id }, '-created_date', 100),
    enabled: !!shop?.id && (section === 'customers' || section === 'reviews'),
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['partner-reviews', shop?.id],
    queryFn: () => base44.entities.Review.filter({ shop_id: shop.id }, '-created_date', 50),
    enabled: !!shop?.id && section === 'reviews',
  });

  const staff = (getCollectionSync('MerchantStaff') || []).filter(
    (s) => s.merchant_id === shop?.id || s.shop_id === shop?.id
  );
  const branches = (getCollectionSync('Branch') || []).filter(
    (b) => b.merchant_id === shop?.id || b.shop_id === shop?.id
  );
  const notifications = (getCollectionSync('Notification') || [])
    .filter((n) => n.recipient_email === shop?.owner_email)
    .slice(0, 20);

  const customers = [...new Set(orders.map((o) => o.customer_email).filter(Boolean))];

  if (section === 'staff') {
    return (
      <SectionShell title="Staff" subtitle="Merchant team roles" icon={Users}>
        {staff.length === 0 ? (
          <Empty text="No staff records yet. Owner is created on registration." />
        ) : (
          staff.map((s) => (
            <Row key={s.id} title={s.name || s.email} meta={s.role || s.staff_role} badge={s.status || 'active'} />
          ))
        )}
      </SectionShell>
    );
  }

  if (section === 'branches') {
    return (
      <SectionShell title="Branches" subtitle="Multi-branch locations" icon={GitBranch}>
        {branches.length === 0 ? (
          <Empty text="Default branch is created with your merchant profile." />
        ) : (
          branches.map((b) => (
            <Row
              key={b.id}
              title={b.name || 'Branch'}
              meta={[b.address, b.manager_name, b.status].filter(Boolean).join(' · ')}
              badge={b.status || 'open'}
            />
          ))
        )}
        <p className="text-[10px] text-muted-foreground mt-3">
          Each branch supports address, hours, manager, staff, delivery radius, inventory, orders, analytics, status, images.
        </p>
      </SectionShell>
    );
  }

  if (section === 'reviews') {
    return (
      <SectionShell title="Reviews" subtitle="Customer feedback" icon={Star}>
        {reviews.length === 0 ? (
          <Empty text="No reviews yet." />
        ) : (
          reviews.map((r) => (
            <Row
              key={r.id}
              title={`${'★'.repeat(r.rating || 0)} ${r.customer_name || r.customer_email || 'Customer'}`}
              meta={r.comment || r.body || ''}
            />
          ))
        )}
      </SectionShell>
    );
  }

  if (section === 'customers') {
    return (
      <SectionShell title="Customers" subtitle="People who ordered" icon={Building2}>
        {customers.length === 0 ? (
          <Empty text="No customers yet." />
        ) : (
          customers.map((email) => <Row key={email} title={email} meta="Repeat purchase analytics coming soon" />)
        )}
      </SectionShell>
    );
  }

  if (section === 'notifications') {
    return (
      <SectionShell title="Notifications" subtitle="Merchant alerts" icon={Bell}>
        {notifications.length === 0 ? (
          <Empty text="No notifications." />
        ) : (
          notifications.map((n) => (
            <Row key={n.id} title={n.title} meta={n.body} badge={n.read ? 'read' : 'new'} />
          ))
        )}
      </SectionShell>
    );
  }

  return null;
}

function SectionShell({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="bg-card rounded-2xl border border-border divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({ title, meta, badge }) {
  return (
    <div className="p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-sm text-foreground">{title}</p>
        {meta && <p className="text-xs text-muted-foreground mt-0.5">{meta}</p>}
      </div>
      {badge && <Badge variant="secondary" className="shrink-0 text-[10px]">{badge}</Badge>}
    </div>
  );
}

function Empty({ text }) {
  return <p className="p-4 text-sm text-muted-foreground">{text}</p>;
}

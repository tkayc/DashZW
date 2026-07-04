import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';
import { useAuth } from '@/lib/AuthContext';
import { getNotifications, markAllRead, markRead } from '@/api';
import { useRealtimeQuery as useQuery } from '@/api';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  categoryForNotificationType,
  MOCK_ANNOUNCEMENTS,
  NOTIFICATION_CHANNELS,
} from '@/domain/notificationArchitecture';

/**
 * In-app notification centre + history + categories.
 * Channels: push (device), SMS/email placeholders.
 * TODO(postgresql): notification history + delivery logs.
 */
export default function NotificationCentre() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState('all');

  const { data: notifs = [], refetch } = useQuery({
    queryKey: ['notif-centre', user?.email],
    queryFn: async () => {
      if (!user?.email) return MOCK_ANNOUNCEMENTS;
      const list = await getNotifications(user.email);
      return [...(list || []), ...MOCK_ANNOUNCEMENTS];
    },
    enabled: !isGuest,
  });

  const enriched = useMemo(
    () =>
      (notifs || []).map((n) => ({
        ...n,
        category: n.category || categoryForNotificationType(n.type),
      })),
    [notifs]
  );

  const filtered =
    category === 'all' ? enriched : enriched.filter((n) => n.category === category);
  const unread = enriched.filter((n) => !n.is_read).length;

  const handleOpen = async (n) => {
    if (n.id && !String(n.id).startsWith('ann_') && user?.email) {
      try {
        await markRead(n.id);
        refetch();
      } catch {}
    }
    if (n.link) navigate(n.link);
  };

  const handleMarkAll = async () => {
    if (!user?.email) return;
    await markAllRead(user.email);
    refetch();
  };

  return (
    <div className="px-4 pt-6 pb-8">
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : 'All caught up'} />

      <div className="flex flex-wrap gap-2 mb-3">
        {Object.values(NOTIFICATION_CHANNELS).map((ch) => (
          <span key={ch} className="text-[10px] bg-muted text-muted-foreground px-2 py-1 rounded-lg capitalize">
            {ch.replace(/_/g, ' ')}
            {(ch === 'sms' || ch === 'email') && ' · soon'}
          </span>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-2" style={{ scrollbarWidth: 'none' }}>
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
            category === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          All
        </button>
        {Object.entries(NOTIFICATION_CATEGORY_LABELS).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCategory(id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
              category === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {unread > 0 && user && (
        <button type="button" onClick={handleMarkAll} className="text-xs font-semibold text-primary mb-3">
          Mark all read
        </button>
      )}

      {isGuest && (
        <p className="text-xs text-muted-foreground mb-3">Sign in to see your order notifications.</p>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">No notifications</div>
        )}
        {filtered.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => handleOpen(n)}
            className={`w-full text-left bg-card border rounded-2xl p-4 ${
              n.is_read ? 'border-border/50 opacity-80' : 'border-primary/30 bg-primary/5'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm text-foreground">{n.title}</p>
              <span className="text-[10px] text-muted-foreground shrink-0 capitalize">
                {NOTIFICATION_CATEGORY_LABELS[n.category] || n.category}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{n.body}</p>
            <p className="text-[10px] text-muted-foreground mt-2">
              {n.created_date ? new Date(n.created_date).toLocaleString() : ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

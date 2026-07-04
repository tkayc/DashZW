import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { requestNotificationPermission } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

/**
 * Notification preferences (local mock).
 * TODO(postgresql): user_notification_prefs table.
 * TODO(backend): Push provider (FCM / APNs) registration.
 */
const PREFS_KEY = 'dashzw_notif_prefs';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function NotificationsSettings() {
  const [prefs, setPrefs] = useState(() => ({
    orderUpdates: true,
    promos: false,
    recommendations: true,
    ...loadPrefs(),
  }));

  const toggle = (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  const rows = [
    { key: 'orderUpdates', label: 'Order updates', desc: 'Status changes and driver messages' },
    { key: 'promos', label: 'Promotions', desc: 'Deals and vouchers' },
    { key: 'recommendations', label: 'Recommendations', desc: 'Personalised merchant picks' },
  ];

  return (
    <div className="px-4 pt-6 pb-8">
      <PageHeader title="Notifications" subtitle="Choose what we send you" />

      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden mb-4">
        {rows.map((row, i) => (
          <label
            key={row.key}
            className={`flex items-center gap-3 p-4 cursor-pointer ${i > 0 ? 'border-t border-border/50' : ''}`}
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{row.label}</p>
              <p className="text-[10px] text-muted-foreground">{row.desc}</p>
            </div>
            <input
              type="checkbox"
              checked={!!prefs[row.key]}
              onChange={() => toggle(row.key)}
              className="w-5 h-5 rounded"
            />
          </label>
        ))}
      </div>

      {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
        <button
          type="button"
          onClick={async () => {
            const perm = await requestNotificationPermission();
            toast.success(perm === 'granted' ? 'Push enabled' : 'Permission denied');
          }}
          className="w-full flex items-center gap-3 bg-primary/10 rounded-2xl p-4 text-left"
        >
          <Bell className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold text-primary">Enable device notifications</span>
        </button>
      )}
    </div>
  );
}

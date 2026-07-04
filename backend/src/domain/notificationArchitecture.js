/**
 * Notification system architecture.
 * Channels: push, SMS (placeholder), email (placeholder), in-app.
 *
 * TODO(postgresql): notifications, notification_preferences, delivery_log.
 * TODO(providers): FCM/APNs, SMS gateway, transactional email.
 */

export const NOTIFICATION_CHANNELS = {
  PUSH: 'push',
  SMS: 'sms',
  EMAIL: 'email',
  IN_APP: 'in_app',
};

export const NOTIFICATION_CATEGORIES = {
  ORDER_UPDATES: 'order_updates',
  PROMOTIONS: 'promotions',
  ANNOUNCEMENTS: 'announcements',
  WALLET: 'wallet',
  SYSTEM: 'system',
};

export const NOTIFICATION_CATEGORY_LABELS = {
  [NOTIFICATION_CATEGORIES.ORDER_UPDATES]: 'Order updates',
  [NOTIFICATION_CATEGORIES.PROMOTIONS]: 'Promotions',
  [NOTIFICATION_CATEGORIES.ANNOUNCEMENTS]: 'Announcements',
  [NOTIFICATION_CATEGORIES.WALLET]: 'Wallet',
  [NOTIFICATION_CATEGORIES.SYSTEM]: 'System',
};

/** Map legacy notification type → category */
export function categoryForNotificationType(type = '') {
  if (type.startsWith('order_') || type === 'new_order' || type === 'job_available') {
    return NOTIFICATION_CATEGORIES.ORDER_UPDATES;
  }
  if (type.includes('promo') || type.includes('deal')) return NOTIFICATION_CATEGORIES.PROMOTIONS;
  if (type.includes('wallet') || type.includes('credit')) return NOTIFICATION_CATEGORIES.WALLET;
  if (type.includes('announce')) return NOTIFICATION_CATEGORIES.ANNOUNCEMENTS;
  return NOTIFICATION_CATEGORIES.SYSTEM;
}

/** Mock announcements for notification centre */
export const MOCK_ANNOUNCEMENTS = [
  {
    id: 'ann_1',
    title: 'Welcome to DashZW Merchants',
    body: 'Order from restaurants, grocery, pharmacy and more.',
    type: 'announcement',
    category: NOTIFICATION_CATEGORIES.ANNOUNCEMENTS,
    is_read: false,
    created_date: new Date().toISOString(),
  },
];

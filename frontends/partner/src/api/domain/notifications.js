import { invoke } from '../client.js';

export const createNotification = (p) => invoke('notifications', 'createNotification', [p]);
export const getNotifications = (e) => invoke('notifications', 'getNotifications', [e]);
export const getUnreadCount = (e) => invoke('notifications', 'getUnreadCount', [e]);
export const markAllRead = (e) => invoke('notifications', 'markAllRead', [e]);
export const markRead = (id) => invoke('notifications', 'markRead', [id]);
export const deleteNotification = (id) => invoke('notifications', 'deleteNotification', [id]);
export const notifyOrderPlaced = (o) => invoke('notifications', 'notifyOrderPlaced', [o]);
export const notifyOrderStatusChanged = (o, s) => invoke('notifications', 'notifyOrderStatusChanged', [o, s]);
export const notifyReplacementNeeded = (o, n) => invoke('notifications', 'notifyReplacementNeeded', [o, n]);
export const notifyReplacementResolved = (o, n, l) => invoke('notifications', 'notifyReplacementResolved', [o, n, l]);
export const notifyShopApproved = (e, n) => invoke('notifications', 'notifyShopApproved', [e, n]);

import { invalidateCollection, getApiBaseUrl } from '../client.js';

export function subscribeToDbChanges(fn) {
  const url = `${getApiBaseUrl()}/api/events`;
  const es = new EventSource(url);
  es.onmessage = (ev) => {
    try {
      const { collection } = JSON.parse(ev.data);
      if (collection) invalidateCollection(collection);
      fn(collection);
    } catch {
      fn();
    }
  };
  return () => es.close();
}

/**
 * usePushNotifications — Web Push API for background alerts
 */
import { useEffect } from 'react';
import { subscribeToDbChanges, getCollection } from '@/api';

export function requestNotificationPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  return Notification.requestPermission();
}

export function sendSystemNotification(title, body, url = '/') {
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;
  const n = new Notification(title, { body, icon: '/favicon.ico' });
  n.onclick = () => { window.focus(); n.close(); };
}

export function useSystemNotifications(email) {
  useEffect(() => {
    if (!email) return;
    let lastCount = 0;

    const refresh = async () => {
      const rows = await getCollection('Notification');
      return rows.filter((n) => n.recipient_email === email && !n.is_read);
    };

    refresh().then((current) => { lastCount = current.length; });

    const unsub = subscribeToDbChanges(() => {
      refresh().then((current) => {
        if (current.length > lastCount && current[0]) {
          sendSystemNotification(current[0].title, current[0].body, current[0].link || '/');
        }
        lastCount = current.length;
      });
    });

    return unsub;
  }, [email]);
}

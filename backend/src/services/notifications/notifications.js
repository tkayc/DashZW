/**
 * notifications.js — DashZW in-app notification system
 *
 * Notifications are stored in localStorage under dashzw_Notification.
 * BroadcastChannel ensures cross-tab delivery instantly.
 *
 * Each notification:
 *  { id, recipient_email, title, body, type, link, is_read, created_date }
 *
 * Types: order_placed | order_confirmed | order_preparing | order_ready |
 *        order_picked_up | order_delivered | order_cancelled |
 *        item_unavailable | wallet_credited | driver_blocked |
 *        new_order (partner) | job_available (driver) | shop_approved
 */

import { getCollection, saveCollection, subscribeToDbChanges } from '../../db/localDb.js';
import { ORDER_STATUS, normalizeOrderStatus } from '../../domain/orderStates.js';

const NOTIF_KEY = 'Notification';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function createNotification({ recipient_email, title, body, type, link = null }) {
  if (!recipient_email) return;
  const notifs = getCollection(NOTIF_KEY);
  notifs.push({
    id: genId(),
    recipient_email,
    title,
    body,
    type,
    link,
    is_read: false,
    created_date: new Date().toISOString(),
  });
  saveCollection(NOTIF_KEY, notifs);
}

export function getNotifications(email) {
  return getCollection(NOTIF_KEY)
    .filter(n => n.recipient_email === email)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 50);
}

export function getUnreadCount(email) {
  return getCollection(NOTIF_KEY).filter(n => n.recipient_email === email && !n.is_read).length;
}

export function markAllRead(email) {
  const notifs = getCollection(NOTIF_KEY).map(n =>
    n.recipient_email === email ? { ...n, is_read: true } : n
  );
  saveCollection(NOTIF_KEY, notifs);
}

export function markRead(id) {
  const notifs = getCollection(NOTIF_KEY).map(n =>
    n.id === id ? { ...n, is_read: true } : n
  );
  saveCollection(NOTIF_KEY, notifs);
}

export function deleteNotification(id) {
  saveCollection(NOTIF_KEY, getCollection(NOTIF_KEY).filter(n => n.id !== id));
}

// ── Order lifecycle notifications ─────────────────────────────────────────────

function merchantDisplayName(order) {
  return order.merchant_name || order.shop_name || 'the merchant';
}

export function notifyOrderPlaced(order) {
  const name = merchantDisplayName(order);
  createNotification({
    recipient_email: order.customer_email,
    title: '✅ Order Placed!',
    body: `Your order from ${name} has been received. Total: ${order.total?.toFixed(2)}`,
    type: 'order_placed',
    link: `/order/${order.id}`,
  });
  if (order.partner_email) {
    createNotification({
      recipient_email: order.partner_email,
      title: '🛎️ New Order!',
      body: `New order from ${order.customer_name || 'a customer'} — ${order.partner_payout?.toFixed(2)} • ${order.payment_method?.replace(/_/g, ' ')}`,
      type: 'new_order',
      link: '/orders',
    });
  }
}

export function notifyOrderStatusChanged(order, newStatus) {
  const status = normalizeOrderStatus(newStatus);
  const name = merchantDisplayName(order);

  const statusMessages = {
    [ORDER_STATUS.ACCEPTED]: {
      title: '👍 Order Accepted',
      body: `${name} accepted your order and will start preparing it soon.`,
    },
    [ORDER_STATUS.PREPARING]: {
      title: '📦 Being Prepared',
      body: `${name} is now preparing your order.`,
    },
    [ORDER_STATUS.READY_FOR_PICKUP]: {
      title: '📦 Ready for Pickup',
      body: `Your order is ready! A driver will pick it up shortly.`,
    },
    [ORDER_STATUS.DRIVER_ASSIGNED]: {
      title: '🛵 Driver Assigned',
      body: `${order.driver_name || 'A driver'} has been assigned to your order from ${name}.`,
    },
    [ORDER_STATUS.PICKED_UP]: {
      title: '🛵 Driver Picked Up',
      body: `${order.driver_name || 'Your driver'} has picked up your order from ${name}.`,
    },
    [ORDER_STATUS.IN_TRANSIT]: {
      title: '🛵 In Transit!',
      body: `${order.driver_name || 'Your driver'} is heading to you. Check your delivery code in the order details.`,
    },
    [ORDER_STATUS.DELIVERED]: {
      title: '🎉 Order Delivered!',
      body: `Your order from ${name} has been delivered.`,
    },
    [ORDER_STATUS.COMPLETED]: {
      title: '✅ Order Completed',
      body: `Your order from ${name} is complete. Thank you!`,
    },
    [ORDER_STATUS.CANCELLED]: {
      title: '❌ Order Cancelled',
      body: `Your order from ${name} was cancelled.`,
    },
    [ORDER_STATUS.REFUNDED]: {
      title: '💸 Order Refunded',
      body: `Your order from ${name} has been refunded.`,
    },
    // Legacy keys still accepted from older clients
    confirmed: {
      title: '👍 Order Accepted',
      body: `${name} accepted your order and will start preparing it soon.`,
    },
    on_the_way: {
      title: '🛵 In Transit!',
      body: `${order.driver_name || 'Your driver'} is heading to you. Check your delivery code in the order details.`,
    },
  };

  const msg = statusMessages[status] || statusMessages[newStatus];
  if (msg && order.customer_email) {
    createNotification({
      recipient_email: order.customer_email,
      title: msg.title,
      body: msg.body,
      type: `order_${status}`,
      link: `/order/${order.id}`,
    });
  }

  if (status === ORDER_STATUS.READY_FOR_PICKUP) {
    createNotification({
      recipient_email: '__drivers__',
      title: '🚀 New Job Available!',
      body: `Order from ${name} is ready for pickup — earn ${order.driver_earning?.toFixed(2)}`,
      type: 'job_available',
      link: '/',
    });
  }

  if (
    (status === ORDER_STATUS.DRIVER_ASSIGNED ||
      status === ORDER_STATUS.PICKED_UP ||
      status === ORDER_STATUS.DELIVERED ||
      status === ORDER_STATUS.COMPLETED) &&
    order.partner_email
  ) {
    const titles = {
      [ORDER_STATUS.DRIVER_ASSIGNED]: '🛵 Driver Assigned',
      [ORDER_STATUS.PICKED_UP]: '🛵 Order Picked Up',
      [ORDER_STATUS.DELIVERED]: '✅ Order Delivered',
      [ORDER_STATUS.COMPLETED]: '✅ Order Completed',
    };
    createNotification({
      recipient_email: order.partner_email,
      title: titles[status] || 'Order Update',
      body:
        status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.COMPLETED
          ? `Order for ${order.customer_name} delivered. Payout: ${order.partner_payout?.toFixed(2)}`
          : `${order.driver_name || 'Driver'} is handling the order for ${order.customer_name}.`,
      type: `order_${status}`,
      link: '/orders',
    });
  }
}

export function notifyItemUnavailable(order, itemName, isCash) {
  createNotification({
    recipient_email: order.customer_email,
    title: '⚠️ Item Unavailable',
    body: isCash
      ? `"${itemName}" is unavailable — your cart total has been reduced.`
      : `"${itemName}" is unavailable — the amount has been credited to your wallet.`,
    type: 'item_unavailable',
    link: `/order/${order.id}`,
  });
}

export function notifyReplacementNeeded(order, itemName) {
  createNotification({
    recipient_email: order.customer_email,
    title: '🛒 Choose a replacement',
    body: `"${itemName}" is out of stock. Pick a replacement or remove it from your order.`,
    type: 'item_replacement_needed',
    link: `/order/${order.id}`,
  });
}

export function notifyReplacementResolved(order, itemName, actionLabel) {
  if (!order.partner_email) return;
  createNotification({
    recipient_email: order.partner_email,
    title: '✅ Customer updated item',
    body: `${order.customer_name || 'Customer'} chose: ${actionLabel} for "${itemName}".`,
    type: 'item_replacement_resolved',
    link: '/partner/orders',
  });
}

export function notifyWalletCredited(email, amount, reason) {
  createNotification({
    recipient_email: email,
    title: `💰 Wallet Credited +${amount.toFixed(2)}`,
    body: reason,
    type: 'wallet_credited',
    link: '/wallet',
  });
}

export function notifyDriverBlocked(driverEmail) {
  createNotification({
    recipient_email: driverEmail,
    title: '🔴 Account Blocked',
    body: 'Top up your wallet to continue accepting COD orders. Visit a partner shop with your Driver ID to top up.',
    type: 'driver_blocked',
    link: '/driver/profile',
  });
}

export function notifyShopApproved(ownerEmail, shopName) {
  createNotification({
    recipient_email: ownerEmail,
    title: '🎉 Shop Approved!',
    body: `"${shopName}" has been approved and is now live on DashZW.`,
    type: 'shop_approved',
    link: '/partner',
  });
}

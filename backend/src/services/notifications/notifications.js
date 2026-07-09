/**
 * notifications.js — DashZW in-app notification system
 *
 * Persisted via localDb.entities.Notification (PostgreSQL or JSON files).
 * SSE invalidation via notifyListeners('Notification').
 */

import { localDb } from '../../db/localDb.js';
import { notifyListeners } from '../../db/store.js';
import { isPostgresEnabled, query } from '../../db/pg.js';
import { categoryForNotificationType } from '../../domain/notificationArchitecture.js';
import { ORDER_STATUS, normalizeOrderStatus } from '../../domain/orderStates.js';

const Notification = () => localDb.entities.Notification;

function emailMatches(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

export async function createNotification({ recipient_email, title, body, type, link = null }) {
  if (!recipient_email) return;
  await Notification().create({
    recipient_email,
    title,
    body,
    type,
    link,
    category: categoryForNotificationType(type),
    channel: 'in_app',
    is_read: false,
  });
}

export async function getNotifications(email) {
  if (!email) return [];
  const rows = await Notification().filter({ recipient_email: email }, '-created_date', 50);
  return rows.filter((n) => emailMatches(n.recipient_email, email));
}

export async function getUnreadCount(email) {
  const rows = await getNotifications(email);
  return rows.filter((n) => !n.is_read).length;
}

export async function markAllRead(email) {
  if (!email) return;
  if (isPostgresEnabled()) {
    await query(
      `UPDATE notifications SET is_read = TRUE WHERE LOWER(recipient_email::text) = LOWER($1)`,
      [email]
    );
    notifyListeners('Notification');
    return;
  }
  const rows = await Notification().filter({ recipient_email: email }, '-created_date', 500);
  await Promise.all(
    rows.filter((n) => !n.is_read).map((n) => Notification().update(n.id, { is_read: true }))
  );
}

export async function markRead(id) {
  await Notification().update(id, { is_read: true });
  if (isPostgresEnabled()) notifyListeners('Notification');
}

export async function deleteNotification(id) {
  await Notification().delete(id);
  if (isPostgresEnabled()) notifyListeners('Notification');
}

// ── Order lifecycle notifications ─────────────────────────────────────────────

function merchantDisplayName(order) {
  return order.merchant_name || order.shop_name || 'the merchant';
}

export async function notifyOrderPlaced(order) {
  const name = merchantDisplayName(order);
  const isCourier = order.order_kind === 'courier';
  await createNotification({
    recipient_email: order.customer_email,
    title: isCourier ? '📦 Courier booked' : '✅ Order Placed!',
    body: isCourier
      ? `Your courier is booked. Share code ${order.delivery_code} with the recipient. Total: $${Number(order.total || 0).toFixed(2)}`
      : `Your order from ${name} has been received. Total: $${Number(order.total || 0).toFixed(2)}`,
    type: 'order_placed',
    link: `/order/${order.id}`,
  });
  if (order.partner_email && !isCourier) {
    await createNotification({
      recipient_email: order.partner_email,
      title: '🛎️ New Order!',
      body: `New order from ${order.customer_name || 'a customer'} — $${Number(order.partner_payout || 0).toFixed(2)} · ${order.payment_method?.replace(/_/g, ' ')}`,
      type: 'new_order',
      link: '/orders',
    });
  }
}

export async function notifyOrderStatusChanged(order, newStatus) {
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
    await createNotification({
      recipient_email: order.customer_email,
      title: msg.title,
      body: msg.body,
      type: `order_${status}`,
      link: `/order/${order.id}`,
    });
  }

  if (status === ORDER_STATUS.READY_FOR_PICKUP) {
    await createNotification({
      recipient_email: '__drivers__',
      title: '🚀 New Job Available!',
      body: `Order from ${name} is ready for pickup — earn ${Number(order.driver_earning || 0).toFixed(2)}`,
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
    await createNotification({
      recipient_email: order.partner_email,
      title: titles[status] || 'Order Update',
      body:
        status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.COMPLETED
          ? `Order for ${order.customer_name} delivered. Payout: ${Number(order.partner_payout || 0).toFixed(2)}`
          : `${order.driver_name || 'Driver'} is handling the order for ${order.customer_name}.`,
      type: `order_${status}`,
      link: '/orders',
    });
  }
}

export async function notifyItemUnavailable(order, itemName, isCash) {
  await createNotification({
    recipient_email: order.customer_email,
    title: '⚠️ Item Unavailable',
    body: isCash
      ? `"${itemName}" is unavailable — your cart total has been reduced.`
      : `"${itemName}" is unavailable — the amount has been credited to your wallet.`,
    type: 'item_unavailable',
    link: `/order/${order.id}`,
  });
}

export async function notifyReplacementNeeded(order, itemName) {
  await createNotification({
    recipient_email: order.customer_email,
    title: '🛒 Choose a replacement',
    body: `"${itemName}" is out of stock. Pick a replacement or remove it from your order.`,
    type: 'item_replacement_needed',
    link: `/order/${order.id}`,
  });
}

export async function notifyReplacementResolved(order, itemName, actionLabel) {
  if (!order.partner_email) return;
  await createNotification({
    recipient_email: order.partner_email,
    title: '✅ Customer updated item',
    body: `${order.customer_name || 'Customer'} chose: ${actionLabel} for "${itemName}".`,
    type: 'item_replacement_resolved',
    link: '/partner/orders',
  });
}

export async function notifyWalletCredited(email, amount, reason) {
  await createNotification({
    recipient_email: email,
    title: `💰 Wallet Credited +${amount.toFixed(2)}`,
    body: reason,
    type: 'wallet_credited',
    link: '/wallet',
  });
}

export async function notifyDriverBlocked(driverEmail) {
  await createNotification({
    recipient_email: driverEmail,
    title: '🔴 Account Blocked',
    body: 'Top up your wallet to continue accepting COD orders. Visit a partner shop with your Driver ID to top up.',
    type: 'driver_blocked',
    link: '/driver/profile',
  });
}

export async function notifyShopApproved(ownerEmail, shopName) {
  await createNotification({
    recipient_email: ownerEmail,
    title: '🎉 Shop Approved!',
    body: `"${shopName}" has been approved and is now live on DashZW.`,
    type: 'shop_approved',
    link: '/partner',
  });
}

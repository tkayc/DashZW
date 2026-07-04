/**
 * Canonical order state model (merchant-platform, not food-specific).
 *
 * States:
 *   Created → Pending Acceptance → Accepted → Preparing → Ready for Pickup
 *   → Driver Assigned → Picked Up → In Transit → Delivered → Completed
 *   (+ Cancelled, Refunded terminal paths)
 *
 * Legacy statuses (pre-merchant refactor) are normalized on read.
 *
 * TODO(postgresql): Column `orders.status` as enum/check constraint using these values.
 * TODO(postgresql): Optional `order_status_history` table for audit trail.
 */

export const ORDER_STATUS = {
  CREATED: 'created',
  PENDING_ACCEPTANCE: 'pending_acceptance',
  ACCEPTED: 'accepted',
  PREPARING: 'preparing',
  READY_FOR_PICKUP: 'ready_for_pickup',
  DRIVER_ASSIGNED: 'driver_assigned',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

export const ORDER_STATUS_LABELS = {
  [ORDER_STATUS.CREATED]: 'Created',
  [ORDER_STATUS.PENDING_ACCEPTANCE]: 'Pending Acceptance',
  [ORDER_STATUS.ACCEPTED]: 'Accepted',
  [ORDER_STATUS.PREPARING]: 'Preparing',
  [ORDER_STATUS.READY_FOR_PICKUP]: 'Ready for Pickup',
  [ORDER_STATUS.DRIVER_ASSIGNED]: 'Driver Assigned',
  [ORDER_STATUS.PICKED_UP]: 'Picked Up',
  [ORDER_STATUS.IN_TRANSIT]: 'In Transit',
  [ORDER_STATUS.DELIVERED]: 'Delivered',
  [ORDER_STATUS.COMPLETED]: 'Completed',
  [ORDER_STATUS.CANCELLED]: 'Cancelled',
  [ORDER_STATUS.REFUNDED]: 'Refunded',
};

/** Map pre-refactor status strings → canonical status. */
export const LEGACY_ORDER_STATUS_MAP = {
  pending: ORDER_STATUS.PENDING_ACCEPTANCE,
  confirmed: ORDER_STATUS.ACCEPTED,
  on_the_way: ORDER_STATUS.IN_TRANSIT,
};

/** Normalize any stored status to the canonical model. */
export function normalizeOrderStatus(status) {
  if (!status) return ORDER_STATUS.CREATED;
  return LEGACY_ORDER_STATUS_MAP[status] || status;
}

export function orderStatusLabel(status) {
  const n = normalizeOrderStatus(status);
  return ORDER_STATUS_LABELS[n] || status;
}

/** Terminal / inactive statuses (order no longer actionable). */
export const TERMINAL_ORDER_STATUSES = [
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.COMPLETED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REFUNDED,
];

export function isTerminalOrderStatus(status) {
  return TERMINAL_ORDER_STATUSES.includes(normalizeOrderStatus(status));
}

export function isActiveOrderStatus(status) {
  return !isTerminalOrderStatus(status);
}

/** Statuses that still need merchant action. */
export const MERCHANT_ACTIONABLE_STATUSES = [
  ORDER_STATUS.PENDING_ACCEPTANCE,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
];

/** Statuses visible as available jobs for drivers. */
export const DRIVER_AVAILABLE_STATUSES = [
  ORDER_STATUS.READY_FOR_PICKUP,
];

/** Statuses for driver active deliveries. */
export const DRIVER_ACTIVE_STATUSES = [
  ORDER_STATUS.DRIVER_ASSIGNED,
  ORDER_STATUS.PICKED_UP,
  ORDER_STATUS.IN_TRANSIT,
];

/**
 * Merchant portal progression (happy path).
 * pending_acceptance → accepted → preparing → ready_for_pickup
 */
export const MERCHANT_STATUS_FLOW = {
  [ORDER_STATUS.PENDING_ACCEPTANCE]: {
    next: ORDER_STATUS.ACCEPTED,
    label: 'Accept Order',
    color: 'bg-blue-500',
  },
  [ORDER_STATUS.ACCEPTED]: {
    next: ORDER_STATUS.PREPARING,
    label: 'Start Preparing',
    color: 'bg-orange-500',
  },
  [ORDER_STATUS.PREPARING]: {
    next: ORDER_STATUS.READY_FOR_PICKUP,
    label: 'Mark Ready for Pickup',
    color: 'bg-purple-500',
  },
};

/**
 * Driver portal progression after assignment.
 * driver_assigned → picked_up → in_transit → delivered → completed
 */
export const DRIVER_STATUS_FLOW = {
  [ORDER_STATUS.DRIVER_ASSIGNED]: {
    next: ORDER_STATUS.PICKED_UP,
    label: 'Mark Picked Up',
  },
  [ORDER_STATUS.PICKED_UP]: {
    next: ORDER_STATUS.IN_TRANSIT,
    label: 'Start Delivery',
  },
  [ORDER_STATUS.IN_TRANSIT]: {
    next: ORDER_STATUS.DELIVERED,
    label: 'Mark Delivered',
  },
};

/** Initial status when customer places an order. */
export const ORDER_STATUS_ON_CREATE = ORDER_STATUS.PENDING_ACCEPTANCE;

/** Status set when a driver accepts a ready job. */
export const ORDER_STATUS_ON_DRIVER_ACCEPT = ORDER_STATUS.DRIVER_ASSIGNED;

/**
 * Statuses that count as "awaiting merchant response" (auto-cancel eligible).
 * Includes legacy `pending`.
 */
export function isAwaitingMerchantAcceptance(status) {
  const n = normalizeOrderStatus(status);
  return n === ORDER_STATUS.PENDING_ACCEPTANCE || status === 'pending';
}

/**
 * Compare status equality after normalization (handles legacy values).
 */
export function orderStatusEquals(a, b) {
  return normalizeOrderStatus(a) === normalizeOrderStatus(b);
}

/**
 * True if status is one of the given list (normalized).
 */
export function orderStatusIn(status, list) {
  const n = normalizeOrderStatus(status);
  return list.some((s) => normalizeOrderStatus(s) === n);
}

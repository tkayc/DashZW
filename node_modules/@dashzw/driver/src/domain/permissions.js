/**
 * Permission matrix — placeholders for middleware / route guards.
 * TODO(postgresql): Load permissions from role_permissions table.
 */

import { ROLES, normalizeRole } from './roles.js';

export const PERMISSIONS = {
  BROWSE_MERCHANTS: 'browse.merchants',
  PLACE_ORDER: 'order.place',
  VIEW_OWN_ORDERS: 'order.view_own',
  MANAGE_WALLET: 'wallet.manage',
  MANAGE_PROFILE: 'profile.manage',
  MERCHANT_MANAGE: 'merchant.manage',
  MERCHANT_ORDERS: 'merchant.orders',
  MERCHANT_CATALOG: 'merchant.catalog',
  MERCHANT_STAFF: 'merchant.staff',
  DRIVER_JOBS: 'driver.jobs',
  SUPPORT_TICKETS: 'support.tickets',
  FINANCE_SETTLE: 'finance.settle',
  ADMIN_ALL: 'admin.all',
};

const ROLE_PERMISSIONS = {
  [ROLES.GUEST]: [PERMISSIONS.BROWSE_MERCHANTS],
  [ROLES.CUSTOMER]: [
    PERMISSIONS.BROWSE_MERCHANTS,
    PERMISSIONS.PLACE_ORDER,
    PERMISSIONS.VIEW_OWN_ORDERS,
    PERMISSIONS.MANAGE_WALLET,
    PERMISSIONS.MANAGE_PROFILE,
  ],
  [ROLES.DRIVER]: [PERMISSIONS.DRIVER_JOBS, PERMISSIONS.MANAGE_PROFILE],
  [ROLES.MERCHANT_OWNER]: [
    PERMISSIONS.MERCHANT_MANAGE,
    PERMISSIONS.MERCHANT_ORDERS,
    PERMISSIONS.MERCHANT_CATALOG,
    PERMISSIONS.MERCHANT_STAFF,
  ],
  [ROLES.MERCHANT_MANAGER]: [
    PERMISSIONS.MERCHANT_ORDERS,
    PERMISSIONS.MERCHANT_CATALOG,
    PERMISSIONS.MERCHANT_STAFF,
  ],
  [ROLES.MERCHANT_CASHIER]: [PERMISSIONS.MERCHANT_ORDERS],
  [ROLES.MERCHANT_KITCHEN]: [PERMISSIONS.MERCHANT_ORDERS],
  [ROLES.MERCHANT_DISPATCHER]: [PERMISSIONS.MERCHANT_ORDERS],
  [ROLES.SUPPORT]: [PERMISSIONS.SUPPORT_TICKETS],
  [ROLES.FINANCE]: [PERMISSIONS.FINANCE_SETTLE],
  [ROLES.ADMIN]: [PERMISSIONS.ADMIN_ALL],
  [ROLES.SUPER_ADMIN]: [PERMISSIONS.ADMIN_ALL],
};

export function roleHasPermission(role, permission) {
  const r = normalizeRole(role);
  if (r === ROLES.ADMIN || r === ROLES.SUPER_ADMIN) return true;
  const perms = ROLE_PERMISSIONS[r] || [];
  return perms.includes(permission);
}

export function requirePermission(user, permission) {
  if (!user) return false;
  return roleHasPermission(user.role || user.staff_role, permission);
}

/** Placeholder middleware for route protection */
export function canAccessCustomerApp(user, isGuest) {
  if (isGuest) return true;
  if (!user) return false;
  const r = normalizeRole(user.role);
  return r === ROLES.CUSTOMER || r === ROLES.GUEST;
}

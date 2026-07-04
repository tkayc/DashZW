/**
 * Platform roles — customer app primarily uses Customer + Guest.
 * Merchant staff roles are defined for shared architecture / future portals.
 *
 * TODO(postgresql): roles + role_permissions tables.
 */

export const ROLES = {
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  MERCHANT_OWNER: 'merchant_owner',
  MERCHANT_MANAGER: 'merchant_manager',
  MERCHANT_CASHIER: 'merchant_cashier',
  MERCHANT_KITCHEN: 'merchant_kitchen',
  MERCHANT_DISPATCHER: 'merchant_dispatcher',
  SUPPORT: 'support',
  FINANCE: 'finance',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  GUEST: 'guest',
};

/** Map legacy partner role → merchant owner */
export const LEGACY_ROLE_MAP = {
  partner: ROLES.MERCHANT_OWNER,
};

export function normalizeRole(role) {
  if (!role) return ROLES.GUEST;
  return LEGACY_ROLE_MAP[role] || role;
}

export const ROLE_LABELS = {
  [ROLES.CUSTOMER]: 'Customer',
  [ROLES.DRIVER]: 'Driver',
  [ROLES.MERCHANT_OWNER]: 'Merchant Owner',
  [ROLES.MERCHANT_MANAGER]: 'Merchant Manager',
  [ROLES.MERCHANT_CASHIER]: 'Merchant Cashier',
  [ROLES.MERCHANT_KITCHEN]: 'Merchant Kitchen Staff',
  [ROLES.MERCHANT_DISPATCHER]: 'Merchant Dispatcher',
  [ROLES.SUPPORT]: 'Support',
  [ROLES.FINANCE]: 'Finance',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.GUEST]: 'Guest',
};

/** Roles allowed to use the customer storefront */
export const CUSTOMER_APP_ROLES = [ROLES.CUSTOMER, ROLES.GUEST];

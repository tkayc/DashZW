/**
 * Merchant staff roles — users attached to a merchant (and optionally a branch).
 *
 * Platform login roles remain: customer | partner | driver | admin.
 * `partner` accounts map to merchant staff with role Owner by default.
 *
 * TODO(postgresql): Table `merchant_staff`
 *   (id, merchant_id, branch_id nullable, user_id, staff_role, permissions jsonb, is_active).
 */

export const MERCHANT_STAFF_ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  CASHIER: 'cashier',
  KITCHEN_PRODUCTION: 'kitchen_production',
  DISPATCHER: 'dispatcher',
};

export const MERCHANT_STAFF_ROLE_LABELS = {
  [MERCHANT_STAFF_ROLES.OWNER]: 'Owner',
  [MERCHANT_STAFF_ROLES.MANAGER]: 'Manager',
  [MERCHANT_STAFF_ROLES.CASHIER]: 'Cashier',
  [MERCHANT_STAFF_ROLES.KITCHEN_PRODUCTION]: 'Kitchen / Production Staff',
  [MERCHANT_STAFF_ROLES.DISPATCHER]: 'Dispatcher',
};

/** Capabilities per staff role (conceptual; enforce in services later). */
export const MERCHANT_STAFF_PERMISSIONS = {
  [MERCHANT_STAFF_ROLES.OWNER]: [
    'merchant.manage',
    'branch.manage',
    'staff.manage',
    'catalog.manage',
    'orders.manage',
    'orders.accept',
    'orders.prepare',
    'orders.dispatch',
    'promotions.manage',
    'earnings.view',
    'payouts.manage',
  ],
  [MERCHANT_STAFF_ROLES.MANAGER]: [
    'branch.manage',
    'staff.view',
    'catalog.manage',
    'orders.manage',
    'orders.accept',
    'orders.prepare',
    'orders.dispatch',
    'promotions.manage',
    'earnings.view',
  ],
  [MERCHANT_STAFF_ROLES.CASHIER]: [
    'orders.view',
    'orders.accept',
    'orders.prepare',
    'catalog.view',
  ],
  [MERCHANT_STAFF_ROLES.KITCHEN_PRODUCTION]: [
    'orders.view',
    'orders.prepare',
    'catalog.view',
  ],
  [MERCHANT_STAFF_ROLES.DISPATCHER]: [
    'orders.view',
    'orders.dispatch',
    'orders.ready',
  ],
};

/**
 * Map legacy platform `partner` user to default staff role.
 * Existing partner accounts are treated as Owner of their merchant.
 */
export function defaultStaffRoleForPartnerUser() {
  return MERCHANT_STAFF_ROLES.OWNER;
}

export function staffHasPermission(staffRole, permission) {
  const perms = MERCHANT_STAFF_PERMISSIONS[staffRole] || [];
  return perms.includes(permission);
}

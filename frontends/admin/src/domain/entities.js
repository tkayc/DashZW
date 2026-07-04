/**
 * Conceptual entity model for the merchant platform.
 *
 * Storage today uses JSON collections (see db/localDb.js). Collection names
 * keep backward-compatible keys (Shop, MenuItem) while the domain language
 * is Merchant, Branch, Product, MerchantStaff.
 *
 * TODO(postgresql): Map these shapes to relational tables:
 *   merchants, merchant_branches, products, product_categories,
 *   merchant_staff, orders, order_items, wallets, transactions.
 */

/** @typedef {import('./merchantCategories.js').MERCHANT_CATEGORIES[number]['id']} MerchantCategoryId */
/** @typedef {import('./merchantStaffRoles.js').MERCHANT_STAFF_ROLES[keyof import('./merchantStaffRoles.js').MERCHANT_STAFF_ROLES]} StaffRole */

/**
 * Merchant — a business that sells products via the platform.
 * Legacy collection name: `Shop`.
 *
 * Fields (conceptual):
 *   id, name, description, category, image_url,
 *   phone, owner_email (primary owner user),
 *   approval_status, rating, is_open, opening_hours,
 *   min_order_amount, payout details, timestamps
 *
 * Branches hold physical locations; a merchant may have many branches.
 */
export const ENTITY_MERCHANT = 'Merchant';
/** @deprecated Prefer ENTITY_MERCHANT — same persisted collection. */
export const ENTITY_SHOP = 'Shop';

/**
 * Branch — a physical location of a merchant.
 * Collection: `Branch`
 *
 * Fields:
 *   id, merchant_id (legacy: shop_id), name, address, city, phone,
 *   lat, lng, is_open, opening_hours, estimated_delivery_time,
 *   is_default, timestamps
 *
 * Existing Shop rows are treated as a merchant with one default branch
 * (branch fields may be denormalized on Shop until migration).
 */
export const ENTITY_BRANCH = 'Branch';

/**
 * Product — sellable catalog item for a merchant (optionally branch-scoped).
 * Legacy collection name: `MenuItem`.
 *
 * Fields:
 *   id, merchant_id / shop_id, branch_id (optional),
 *   name, description, price, category (product category string),
 *   image_url, is_popular, is_available, timestamps
 */
export const ENTITY_PRODUCT = 'Product';
/** @deprecated Prefer ENTITY_PRODUCT — same persisted collection. */
export const ENTITY_MENU_ITEM = 'MenuItem';

/**
 * MerchantStaff — links a platform user to a merchant (and optional branch).
 * Collection: `MerchantStaff`
 *
 * Fields:
 *   id, merchant_id, branch_id (nullable = all branches),
 *   user_email, staff_role, is_active, timestamps
 */
export const ENTITY_MERCHANT_STAFF = 'MerchantStaff';

/**
 * Resolve merchant id from an order or shop-like record.
 * Supports both merchant_id and legacy shop_id.
 */
export function getMerchantId(record) {
  if (!record) return null;
  return record.merchant_id || record.shop_id || null;
}

/**
 * Resolve branch id from a record (order, product, staff).
 */
export function getBranchId(record) {
  if (!record) return null;
  return record.branch_id || null;
}

/**
 * Build default branch payload from a legacy Shop/merchant location fields.
 * Used until branches are fully migrated off the Shop document.
 */
export function defaultBranchFromMerchant(merchant) {
  if (!merchant) return null;
  return {
    id: merchant.default_branch_id || `branch_default_${merchant.id}`,
    merchant_id: merchant.id,
    shop_id: merchant.id, // legacy alias
    name: merchant.branch_name || 'Main',
    address: merchant.address || '',
    city: merchant.city || '',
    phone: merchant.phone || '',
    lat: merchant.lat,
    lng: merchant.lng,
    is_open: merchant.is_open !== false,
    opening_hours: merchant.opening_hours || '',
    estimated_delivery_time: merchant.estimated_delivery_time || '',
    is_default: true,
  };
}

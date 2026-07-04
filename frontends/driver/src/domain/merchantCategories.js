/**
 * Merchant categories — platform is merchant-based, not food-only.
 * Merchants may be restaurants, grocery, pharmacy, convenience, etc.
 *
 * TODO(postgresql): Persist categories in a `merchant_categories` table
 *   (id, slug, label, icon, sort_order, is_active).
 */

export const MERCHANT_CATEGORIES = [
  { id: 'restaurant', label: 'Restaurants', icon: '🍽️' },
  { id: 'fast_food', label: 'Fast Food', icon: '🍔' },
  { id: 'grocery', label: 'Grocery', icon: '🛒' },
  { id: 'pharmacy', label: 'Pharmacy', icon: '💊' },
  { id: 'convenience', label: 'Convenience', icon: '🏪' },
  { id: 'bakery', label: 'Bakery', icon: '🥐' },
  { id: 'drinks', label: 'Drinks', icon: '🥤' },
  { id: 'desserts', label: 'Desserts', icon: '🍰' },
  { id: 'flowers', label: 'Flower Shops', icon: '💐' },
  { id: 'hardware', label: 'Hardware', icon: '🔧' },
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'other', label: 'Other', icon: '📦' },
];

export const MERCHANT_CATEGORY_IDS = MERCHANT_CATEGORIES.map((c) => c.id);

export function getMerchantCategory(id) {
  return MERCHANT_CATEGORIES.find((c) => c.id === id) || MERCHANT_CATEGORIES.find((c) => c.id === 'other');
}

/** @deprecated Use MERCHANT_CATEGORIES — kept for older UI lists that used "shop categories". */
export const SHOP_CATEGORIES = MERCHANT_CATEGORIES;

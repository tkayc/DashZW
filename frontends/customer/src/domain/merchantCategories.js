/**
 * Merchant categories — platform is merchant-based, not food-only.
 */
import { CATEGORY_ICON_SRC } from '@assets/icons/index.js';

export const MERCHANT_CATEGORIES = [
  { id: 'restaurant', label: 'Restaurants', icon: '🍽️', iconSrc: CATEGORY_ICON_SRC.restaurant },
  { id: 'fast_food', label: 'Fast Food', icon: '🍔', iconSrc: CATEGORY_ICON_SRC.fast_food },
  { id: 'grocery', label: 'Grocery', icon: '🛒' },
  { id: 'pharmacy', label: 'Pharmacy', icon: '💊' },
  { id: 'convenience', label: 'Convenience', icon: '🏪' },
  { id: 'bakery', label: 'Bakery', icon: '🥐', iconSrc: CATEGORY_ICON_SRC.bakery },
  { id: 'drinks', label: 'Drinks', icon: '🥤', iconSrc: CATEGORY_ICON_SRC.drinks },
  { id: 'desserts', label: 'Desserts', icon: '🍰', iconSrc: CATEGORY_ICON_SRC.desserts },
  { id: 'flowers', label: 'Flower Shops', icon: '💐' },
  { id: 'hardware', label: 'Hardware', icon: '🔧' },
  { id: 'electronics', label: 'Electronics', icon: '📱' },
  { id: 'other', label: 'Other', icon: '📦' },
];

export const MERCHANT_CATEGORY_IDS = MERCHANT_CATEGORIES.map((c) => c.id);

export function getMerchantCategory(id) {
  return MERCHANT_CATEGORIES.find((c) => c.id === id) || MERCHANT_CATEGORIES.find((c) => c.id === 'other');
}

/** @deprecated Use MERCHANT_CATEGORIES */
export const SHOP_CATEGORIES = MERCHANT_CATEGORIES;

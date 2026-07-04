/**
 * Promotion framework — coupons, merchant/platform promos, flash sales, etc.
 * Checkout already validates shop + admin coupons via API.
 *
 * TODO(postgresql): promotions, promo_redemptions, flash_sales tables.
 */

export const PROMO_TYPES = {
  COUPON: 'coupon',
  PROMO_CODE: 'promo_code',
  MERCHANT_PROMOTION: 'merchant_promotion',
  PLATFORM_PROMOTION: 'platform_promotion',
  FREE_DELIVERY: 'free_delivery',
  FLASH_SALE: 'flash_sale',
  LOYALTY_REWARD: 'loyalty_reward',
  REFERRAL_REWARD: 'referral_reward',
  FIRST_ORDER: 'first_order_discount',
};

/** Mock deals for Home / Deals rail */
export const MOCK_DEALS = [
  {
    id: 'deal_free_del',
    type: PROMO_TYPES.FREE_DELIVERY,
    title: 'Free delivery weekend',
    body: 'On orders over R150',
    badge: 'Platform',
    emoji: '🚚',
  },
  {
    id: 'deal_flash',
    type: PROMO_TYPES.FLASH_SALE,
    title: 'Flash sale · 20% off',
    body: 'Selected merchants · ends tonight',
    badge: 'Flash',
    emoji: '⚡',
  },
  {
    id: 'deal_first',
    type: PROMO_TYPES.FIRST_ORDER,
    title: 'First order R30 off',
    body: 'New customers · code WELCOME30',
    badge: 'New',
    emoji: '🎉',
  },
  {
    id: 'deal_loyalty',
    type: PROMO_TYPES.LOYALTY_REWARD,
    title: 'Loyalty bonus',
    body: '100 pts = R10 wallet credit',
    badge: 'Rewards',
    emoji: '⭐',
  },
  {
    id: 'deal_ref',
    type: PROMO_TYPES.REFERRAL_REWARD,
    title: 'Refer a friend',
    body: 'You both get R10',
    badge: 'Referral',
    emoji: '👥',
  },
];

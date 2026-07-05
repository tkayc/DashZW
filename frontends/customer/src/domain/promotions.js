/**
 * Promotion framework — coupons, merchant/platform promos, flash sales, etc.
 */
import {
  burger,
  chickenLeg,
  pizza,
  softDrink,
  iceCream,
  delivery,
} from '@assets/icons/index.js';

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

/** Shop deal ads for Home hero carousel */
export const SHOP_DEAL_ADS = [
  {
    id: 'ad_mamas',
    shopId: 'mrc_mamas',
    shopName: "Mama's Kitchen",
    title: '20% off family platters',
    subtitle: 'Sadza, nyama & sides · order before 8pm',
    cta: 'Grab deal',
    iconSrc: chickenLeg,
    accent: 'from-amber-600 via-orange-600 to-red-600',
  },
  {
    id: 'ad_zimburger',
    shopId: 'mrc_zimburger',
    shopName: 'Zim Burger Co',
    title: 'Buy 2 burgers, get fries free',
    subtitle: 'Double stack combo · Sandton delivery',
    cta: 'Order burgers',
    iconSrc: burger,
    accent: 'from-yellow-500 via-amber-500 to-orange-600',
  },
  {
    id: 'ad_sunrise',
    shopId: 'mrc_sunrise',
    shopName: 'Sunrise Bakery',
    title: 'Morning pastry box $12',
    subtitle: 'Croissants, muffins & fresh bread',
    cta: 'Shop bakery',
    iconSrc: pizza,
    accent: 'from-rose-400 via-pink-500 to-fuchsia-600',
  },
  {
    id: 'ad_chillsip',
    shopId: 'mrc_chillsip',
    shopName: 'Chill & Sip',
    title: '2-for-1 smoothies today',
    subtitle: 'Beat the heat · iced drinks & bowls',
    cta: 'Get refreshed',
    iconSrc: softDrink,
    accent: 'from-cyan-500 via-sky-500 to-blue-600',
  },
  {
    id: 'ad_sweettooth',
    shopId: 'mrc_sweettooth',
    shopName: 'Sweet Tooth',
    title: '$5 off orders over $25',
    subtitle: 'Cakes, donuts & dessert boxes',
    cta: 'Sweeten up',
    iconSrc: iceCream,
    accent: 'from-violet-500 via-purple-500 to-indigo-600',
  },
  {
    id: 'ad_freshmart',
    shopId: 'mrc_freshmart',
    shopName: 'FreshMart',
    title: 'Free delivery on groceries',
    subtitle: 'Fresh produce & pantry staples',
    cta: 'Stock up',
    iconSrc: delivery,
    accent: 'from-emerald-500 via-green-600 to-teal-600',
  },
];

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

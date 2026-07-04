/**
 * Recently viewed merchants (local mock).
 * TODO(postgresql): user_recently_viewed table.
 */

const KEY = 'dashzw_recently_viewed';
const MAX = 12;

export function getRecentlyViewedIds() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function trackMerchantView(merchantId) {
  if (!merchantId) return;
  const ids = getRecentlyViewedIds().filter((id) => id !== merchantId);
  ids.unshift(merchantId);
  localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
}

/**
 * Local favourites store (merchants + products).
 * TODO(postgresql): Sync with customer_favourites table.
 */

const KEY = 'dashzw_customer_favourites';

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{"merchants":[],"products":[]}');
  } catch {
    return { merchants: [], products: [] };
  }
}

function write(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function getFavourites() {
  return read();
}

export function isMerchantFavourite(id) {
  return read().merchants.includes(id);
}

export function isProductFavourite(id) {
  return read().products.includes(id);
}

export function toggleMerchantFavourite(id) {
  const data = read();
  const set = new Set(data.merchants);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  data.merchants = [...set];
  write(data);
  return set.has(id);
}

export function toggleProductFavourite(id) {
  const data = read();
  const set = new Set(data.products);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  data.products = [...set];
  write(data);
  return set.has(id);
}

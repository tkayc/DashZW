/**
 * JSON entity store. Domain: Merchant (=Shop), Product (=MenuItem), Branch, MerchantStaff.
 * TODO(postgresql): Replace makeEntity with SQL repositories for these collections.
 */
import { getCollection, saveCollection, subscribeToDbChanges } from './store.js';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function applySort(items, sortKey) {
  if (!sortKey) return items;
  const desc = sortKey.startsWith('-');
  const key = desc ? sortKey.slice(1) : sortKey;
  return [...items].sort((a, b) => {
    const av = a[key] ?? '';
    const bv = b[key] ?? '';
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function makeEntity(collectionName) {
  return {
    list: async (sortKey = '-created_date', limit = 50) => {
      return applySort(getCollection(collectionName), sortKey).slice(0, limit);
    },
    filter: async (filters = {}, sortKey = '-created_date', limit = 100) => {
      let items = getCollection(collectionName);
      items = items.filter((item) =>
        Object.entries(filters).every(([k, v]) => item[k] === v)
      );
      return applySort(items, sortKey).slice(0, limit);
    },
    create: async (data) => {
      const items = getCollection(collectionName);
      const newItem = {
        ...data,
        id: generateId(),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };
      items.push(newItem);
      saveCollection(collectionName, items);
      return newItem;
    },
    update: async (id, data) => {
      const items = getCollection(collectionName);
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error(`Item ${id} not found in ${collectionName}`);
      items[idx] = { ...items[idx], ...data, updated_date: new Date().toISOString() };
      saveCollection(collectionName, items);
      return items[idx];
    },
    delete: async (id) => {
      const items = getCollection(collectionName);
      saveCollection(
        collectionName,
        items.filter((i) => i.id !== id)
      );
      return { id };
    },
  };
}

export { subscribeToDbChanges, getCollection, saveCollection };

// Shop / MenuItem collections persist merchant / product data (legacy names).
// Merchant / Product aliases expose the same collections under domain names.
const shopEntity = makeEntity('Shop');
const menuItemEntity = makeEntity('MenuItem');

export const localDb = {
  entities: {
    // Legacy collection names (still used by existing clients)
    Shop: shopEntity,
    MenuItem: menuItemEntity,
    // Domain aliases (same storage)
    Merchant: shopEntity,
    Product: menuItemEntity,
    // Multi-branch + staff (new collections)
    Branch: makeEntity('Branch'),
    MerchantStaff: makeEntity('MerchantStaff'),
    Order: makeEntity('Order'),
    Review: makeEntity('Review'),
    Promotion: makeEntity('Promotion'),
    Wallet: makeEntity('Wallet'),
    Transaction: makeEntity('Transaction'),
    DriverProfile: makeEntity('DriverProfile'),
    Notification: makeEntity('Notification'),
    AdminPromotion: makeEntity('AdminPromotion'),
    Settlement: makeEntity('Settlement'),
    Withdrawal: makeEntity('Withdrawal'),
    Referral: makeEntity('Referral'),
    LoyaltyPoints: makeEntity('LoyaltyPoints'),
    DriverIncident: makeEntity('DriverIncident'),
  },
};

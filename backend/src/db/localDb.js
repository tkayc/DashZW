/**
 * Entity store — PostgreSQL when DATABASE_URL is set, otherwise JSON files.
 * Entities are resolved per-call so dotenv can load before first use.
 */
import { getCollection, saveCollection, subscribeToDbChanges, notifyListeners } from './store.js';
import { isPostgresEnabled } from './pg.js';
import { makePgEntity, hasPgEntity } from './pgEntities.js';

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

function makeJsonEntity(collectionName) {
  const fileName =
    collectionName === 'Merchant' ? 'Shop'
      : collectionName === 'Product' ? 'MenuItem'
        : collectionName;

  return {
    list: async (sortKey = '-created_date', limit = 50) => {
      return applySort(getCollection(fileName), sortKey).slice(0, limit);
    },
    filter: async (filters = {}, sortKey = '-created_date', limit = 100) => {
      let items = getCollection(fileName);
      items = items.filter((item) =>
        Object.entries(filters).every(([k, v]) => item[k] === v)
      );
      return applySort(items, sortKey).slice(0, limit);
    },
    create: async (data) => {
      const items = getCollection(fileName);
      const newItem = {
        ...data,
        id: generateId(),
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };
      items.push(newItem);
      saveCollection(fileName, items);
      return newItem;
    },
    update: async (id, data) => {
      const items = getCollection(fileName);
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) throw new Error(`Item ${id} not found in ${fileName}`);
      items[idx] = { ...items[idx], ...data, updated_date: new Date().toISOString() };
      saveCollection(fileName, items);
      return items[idx];
    },
    delete: async (id) => {
      const items = getCollection(fileName);
      saveCollection(
        fileName,
        items.filter((i) => i.id !== id)
      );
      return { id };
    },
  };
}

/**
 * Wrap a PostgreSQL entity so every successful write broadcasts a realtime
 * change event for its collection — mirroring the JSON store's
 * saveCollection() → notifyListeners() behavior so all apps stay in sync.
 */
function withRealtimeNotify(collectionName, entity) {
  const wrap = (fn) =>
    async (...args) => {
      const result = await fn(...args);
      notifyListeners(collectionName);
      return result;
    };
  return {
    ...entity,
    create: wrap(entity.create),
    update: wrap(entity.update),
    delete: wrap(entity.delete),
  };
}

function resolveEntity(collectionName) {
  if (isPostgresEnabled() && hasPgEntity(collectionName)) {
    return withRealtimeNotify(collectionName, makePgEntity(collectionName));
  }
  return makeJsonEntity(collectionName);
}

/** Lazy proxy so each method uses current PG/JSON mode */
function lazyEntity(collectionName) {
  return {
    list: (...args) => resolveEntity(collectionName).list(...args),
    filter: (...args) => resolveEntity(collectionName).filter(...args),
    create: (...args) => resolveEntity(collectionName).create(...args),
    update: (...args) => resolveEntity(collectionName).update(...args),
    delete: (...args) => resolveEntity(collectionName).delete(...args),
  };
}

export { subscribeToDbChanges, getCollection, saveCollection };

const NAMES = [
  'Shop', 'MenuItem', 'Merchant', 'Product', 'Branch', 'MerchantStaff',
  'Order', 'Review', 'Promotion', 'Wallet', 'Transaction', 'DriverProfile',
  'Notification', 'AdminPromotion', 'Settlement', 'Withdrawal', 'Referral',
  'LoyaltyPoints', 'DriverIncident',
  'LedgerTransaction', 'FinancialAuditLog', 'FloatTopUp', 'SettlementRun',
  'MerchantFinancialConfig', 'DriverFloatAccount',
];

export const localDb = {
  entities: Object.fromEntries(NAMES.map((n) => [n, lazyEntity(n)])),
};

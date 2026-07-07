// TODO(postgresql): Point entity clients at REST resources backed by PostgreSQL.
import { resolveApiBaseUrl } from '@shared/apiBaseUrl.js';

const TOKEN_KEY = 'dashzw_token';

export function getApiBaseUrl() {
  return resolveApiBaseUrl();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || res.statusText);
  return data;
}

function makeEntityClient(collection) {
  return {
    list: async (sortKey = '-created_date', limit = 50) => {
      const q = new URLSearchParams({ sort: sortKey, limit: String(limit) });
      return apiFetch(`/api/entities/${collection}/list?${q}`);
    },
    filter: async (filters = {}, sortKey = '-created_date', limit = 100) => {
      const q = new URLSearchParams({
        sort: sortKey,
        limit: String(limit),
        filters: JSON.stringify(filters),
      });
      return apiFetch(`/api/entities/${collection}/filter?${q}`);
    },
    create: async (data) =>
      apiFetch(`/api/entities/${collection}`, { method: 'POST', body: JSON.stringify(data) }),
    update: async (id, data) =>
      apiFetch(`/api/entities/${collection}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: async (id) =>
      apiFetch(`/api/entities/${collection}/${id}`, { method: 'DELETE' }),
  };
}

export async function invoke(module, method, args = [], { public: isPublic = false } = {}) {
  const path = isPublic ? '/api/domain/invoke-public' : '/api/domain/invoke';
  const { result } = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify({ module, method, args }),
  });
  return result;
}

const collectionCache = {};
const collectionLoading = {};

export function invalidateCollection(name) {
  Object.keys(collectionCache).forEach((key) => {
    if (key === name || key.startsWith(`${name}:`)) delete collectionCache[key];
  });
  Object.keys(collectionLoading).forEach((key) => {
    if (key === name || key.startsWith(`${name}:`)) delete collectionLoading[key];
  });
}

/** Policy-filtered list (replaces unrestricted /raw). */
export async function getCollection(name, limit = 100) {
  const cacheKey = `${name}:${limit}`;
  if (collectionCache[cacheKey]) return collectionCache[cacheKey];
  if (!collectionLoading[cacheKey]) {
    collectionLoading[cacheKey] = apiFetch(
      `/api/entities/${name}/list?sort=-created_date&limit=${limit}`
    ).then((data) => {
      collectionCache[cacheKey] = Array.isArray(data) ? data : [];
      if (limit === 100) collectionCache[name] = collectionCache[cacheKey];
      delete collectionLoading[cacheKey];
      return collectionCache[cacheKey];
    });
  }
  return collectionLoading[cacheKey];
}

/** Sync read from cache (call after preload or getCollection) */
export function getCollectionSync(name) {
  return collectionCache[name] ?? collectionCache[`${name}:100`] ?? [];
}

/** Raw overwrite removed — use entity create/update/delete. */
export async function saveCollection() {
  throw new Error('Raw collection overwrite is disabled. Use entity create/update/delete.');
}

export async function preloadCollections(names, limit = 80) {
  await Promise.all(names.map((n) => getCollection(n, limit)));
}

export function createApiClient() {
  const auth = {
    login: async (email, password) => {
      const { user, token } = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(token);
      cacheUser(user);
      return user;
    },
    register: async (data) => {
      const { user, token } = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      setToken(token);
      cacheUser(user);
      return user;
    },
    me: async () => apiFetch('/api/auth/me'),
    logout: () => {
      setToken(null);
      cacheUser(null);
      if (typeof window !== 'undefined') window.location.href = '/login';
    },
    getCurrentUser: () => {
      const raw = localStorage.getItem('dashzw_user');
      return raw ? JSON.parse(raw) : null;
    },
    listUsers: async () => apiFetch('/api/auth/users'),
    updateUser: async (email, data) =>
      apiFetch(`/api/auth/users/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  };

  const entities = {
    Shop: makeEntityClient('Shop'),
    MenuItem: makeEntityClient('MenuItem'),
    // Domain aliases (Merchant = Shop, Product = MenuItem)
    Merchant: makeEntityClient('Merchant'),
    Product: makeEntityClient('Product'),
    Branch: makeEntityClient('Branch'),
    MerchantStaff: makeEntityClient('MerchantStaff'),
    Order: makeEntityClient('Order'),
    Review: makeEntityClient('Review'),
    Promotion: makeEntityClient('Promotion'),
    Wallet: makeEntityClient('Wallet'),
    Transaction: makeEntityClient('Transaction'),
    DriverProfile: makeEntityClient('DriverProfile'),
    Notification: makeEntityClient('Notification'),
    DriverIncident: makeEntityClient('DriverIncident'),
  };

  return { auth, entities };
}

export const base44 = createApiClient();

/** Persist user snapshot for sync getCurrentUser */
export function cacheUser(user) {
  if (user) localStorage.setItem('dashzw_user', JSON.stringify(user));
  else localStorage.removeItem('dashzw_user');
}

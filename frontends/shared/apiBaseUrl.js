/**
 * API base URL — in dev, use same-origin (Vite proxies /api → backend).
 * Set VITE_API_URL for production or custom backend host.
 */
export function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return '';
  return 'http://localhost:3001';
}

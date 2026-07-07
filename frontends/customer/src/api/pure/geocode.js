/**
 * geocode.js — address → coordinates + distance
 *
 * Strategy:
 *  1. Shop coords are hardcoded in seed data (shop.lat, shop.lng) — no API call needed
 *  2. Customer address: uses browser Geolocation API for "use my location"
 *  3. Customer typed address: resolved via the backend's /api/location/geocode
 *     endpoint (server-side Nominatim call, cached, with SA country/city
 *     defaults applied). We do NOT call Nominatim directly from the browser:
 *     browsers silently strip/ignore custom User-Agent headers on fetch, and
 *     Nominatim's usage policy disallows unidentified client-side calls —
 *     that combination is what caused checkout to get stuck on "calculating
 *     distance" for addresses the direct browser call couldn't resolve.
 *  4. Haversine formula for the final distance calculation
 */
import { locationApi } from '../location.js';

const cache = new Map();

/**
 * Geocode any address string via the backend (server-side Nominatim,
 * cached, with default country/city applied so partial addresses like
 * "12 Oak Ave" still resolve against South Africa / Johannesburg).
 */
export async function geocodeAddress(address) {
  const key = address.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const result = await locationApi.geocode(address.trim());
    if (result?.lat == null || result?.lng == null) return null;
    const coords = { lat: result.lat, lng: result.lng };
    cache.set(key, coords);
    return coords;
  } catch (err) {
    console.warn('[geocode] backend geocode failed:', err.message);
    return null;
  }
}

/** Haversine great-circle distance in km */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180)
             * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Get browser GPS position (returns Promise<{lat, lng} | null>)
 */
export function getBrowserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => resolve(null),
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}

/**
 * Calculate distance from a shop (which has hardcoded lat/lng) to a customer address.
 *
 * shopCoords: { lat, lng } — from shop.lat / shop.lng in the DB
 * customerAddress: string typed by customer, OR { lat, lng } from GPS
 *
 * Returns km (float) or null on failure.
 */
export async function calcDistanceFromShop(shopCoords, customerInput) {
  if (!shopCoords?.lat || !shopCoords?.lng) return null;

  let customerCoords;

  if (typeof customerInput === 'object' && customerInput?.lat) {
    // Already resolved coords (from GPS)
    customerCoords = customerInput;
  } else if (typeof customerInput === 'string' && customerInput.trim()) {
    // Geocode typed address
    customerCoords = await geocodeAddress(customerInput.trim());
  }

  if (!customerCoords) return null;
  return haversineKm(shopCoords.lat, shopCoords.lng, customerCoords.lat, customerCoords.lng);
}

// Legacy export kept for backwards compatibility
export async function getDistanceKm(fromAddress, toAddress) {
  const [from, to] = await Promise.all([
    geocodeAddress(fromAddress),
    geocodeAddress(toAddress),
  ]);
  if (!from || !to) return null;
  return haversineKm(from.lat, from.lng, to.lat, to.lng);
}
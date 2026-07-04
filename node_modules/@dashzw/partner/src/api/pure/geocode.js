/**
 * geocode.js — address → coordinates + distance
 *
 * Strategy:
 *  1. Shop coords are hardcoded in seed data (shop.lat, shop.lng) — no API call needed
 *  2. Customer address: uses browser Geolocation API for "use my location"
 *  3. Customer typed address: uses Nominatim (OSM) WITHOUT country suffix,
 *     so the user can type a full SA address and it resolves correctly
 *  4. Haversine formula for the final distance calculation
 */

const cache = new Map();

/**
 * Geocode any address string via Nominatim.
 * Does NOT append country — caller should include city/country in the string if needed.
 */
export async function geocodeAddress(address) {
  const key = address.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const q   = encodeURIComponent(address.trim());
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=0`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'DashZW-App/1.0',
        },
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.length) return null;
    const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    cache.set(key, coords);
    return coords;
  } catch (err) {
    console.warn('[geocode] Nominatim failed:', err.message);
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

/**
 * GeocodingService — forward & reverse geocode (PART 5).
 * Uses Nominatim (OSM) by default; Google Geocoding when configured.
 */
import { getMapsConfig } from './config.js';

const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { value, ts: Date.now() });
}

function parseNominatimAddress(item) {
  const addr = item.address || {};
  return {
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    formatted_address: item.display_name || '',
    street_address: [addr.house_number, addr.road].filter(Boolean).join(' ') || item.display_name?.split(',')[0] || '',
    suburb: addr.suburb || addr.neighbourhood || addr.quarter || '',
    city: addr.city || addr.town || addr.village || addr.municipality || '',
    province: addr.state || addr.region || '',
    country: addr.country || '',
    postal_code: addr.postcode || '',
  };
}

async function geocodeNominatim(query) {
  const cfg = getMapsConfig();
  const url = `${cfg.openstreetmap.geocodeUrl}/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': cfg.openstreetmap.userAgent,
    },
  });
  if (!res.ok) throw new Error(`Geocode failed (${res.status})`);
  const data = await res.json();
  if (!data.length) return null;
  return parseNominatimAddress(data[0]);
}

async function reverseNominatim(lat, lng) {
  const cfg = getMapsConfig();
  const url = `${cfg.openstreetmap.geocodeUrl}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': cfg.openstreetmap.userAgent,
    },
  });
  if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);
  const data = await res.json();
  if (!data?.lat) return null;
  return parseNominatimAddress(data);
}

// TODO(Google Geocoding API): replace when GOOGLE_GEOCODING_ENABLED=1
async function geocodeGoogle(_query) {
  throw new Error('Google Geocoding not configured — set GOOGLE_MAPS_API_KEY and GOOGLE_GEOCODING_ENABLED=1');
}

async function reverseGoogle(_lat, _lng) {
  throw new Error('Google Geocoding not configured — set GOOGLE_MAPS_API_KEY and GOOGLE_GEOCODING_ENABLED=1');
}

export async function geocodeAddress(address, { country, city } = {}) {
  const cfg = getMapsConfig();
  const parts = [address, city, country || cfg.defaults.country].filter(Boolean);
  const query = parts.join(', ');
  const key = `fwd:${query.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  let result;
  if (cfg.google.geocodingApi) {
    result = await geocodeGoogle(query);
  } else {
    result = await geocodeNominatim(query);
  }
  if (result) cacheSet(key, result);
  return result;
}

export async function reverseGeocode(lat, lng) {
  const key = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const cfg = getMapsConfig();
  let result;
  if (cfg.google.geocodingApi) {
    result = await reverseGoogle(lat, lng);
  } else {
    result = await reverseNominatim(lat, lng);
  }
  if (result) cacheSet(key, result);
  return result;
}

export async function searchPlaces(query, { limit = 5, country, city } = {}) {
  const cfg = getMapsConfig();
  // TODO(Google Places API): autocomplete when GOOGLE_PLACES_ENABLED=1
  const q = [query, city || cfg.defaults.city, country || cfg.defaults.country].filter(Boolean).join(', ');
  const url = `${cfg.openstreetmap.geocodeUrl}/search?q=${encodeURIComponent(q)}&format=json&limit=${limit}&addressdetails=1`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': cfg.openstreetmap.userAgent },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map(parseNominatimAddress);
}

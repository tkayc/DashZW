/**
 * DistanceService — haversine + optional road distance (PART 4 / 5).
 */
import { getMapsConfig } from './config.js';
import { calcDeliveryFee } from '../payments/finance.js';

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateDeliveryMinutes(distanceKm, isOpen = true) {
  if (!isOpen) return null;
  const base = 15;
  const perKm = 4;
  return Math.max(15, Math.round(base + distanceKm * perKm));
}

export function quoteDelivery(distanceKm) {
  const fee = calcDeliveryFee(distanceKm);
  return {
    distance_km: distanceKm != null ? parseFloat(distanceKm.toFixed(2)) : null,
    delivery_fee: fee,
    estimated_delivery_mins: distanceKm != null ? estimateDeliveryMinutes(distanceKm) : null,
  };
}

/**
 * TODO(Google Distance Matrix API): road distance + traffic-aware ETA
 */
export async function roadDistance(origin, destination) {
  const cfg = getMapsConfig();
  if (cfg.google.distanceMatrixApi) {
    throw new Error('Google Distance Matrix not yet wired — use haversine fallback');
  }

  const km = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
  return {
    distance_km: parseFloat(km.toFixed(2)),
    duration_mins: estimateDeliveryMinutes(km),
    provider: 'haversine',
  };
}

export function isWithinRadius(customerLat, customerLng, merchantLat, merchantLng, radiusKm) {
  if (merchantLat == null || merchantLng == null || customerLat == null || customerLng == null) {
    return false;
  }
  return haversineKm(customerLat, customerLng, merchantLat, merchantLng) <= radiusKm;
}

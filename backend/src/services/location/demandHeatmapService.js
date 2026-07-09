/**
 * Driver demand heatmap — cluster unassigned ready orders into hot zones.
 */
import { localDb } from '../../db/localDb.js';
import { ORDER_STATUS, normalizeOrderStatus } from '../../domain/orderStates.js';
import { calcSurgeMultiplier } from '../admin/surgePricing.js';

/** ~550m grid cells at equator; good enough for city heat blobs */
const CELL_DEG = 0.005;

const OPEN_STATUSES = new Set([
  ORDER_STATUS.READY_FOR_PICKUP,
  ORDER_STATUS.PENDING_ACCEPTANCE,
]);

function pickupCoords(order) {
  const lat =
    order.pickup_lat ??
    order.pack_progress?.courier_meta?.pickup_lat ??
    order.shop_lat;
  const lng =
    order.pickup_lng ??
    order.pack_progress?.courier_meta?.pickup_lng ??
    order.shop_lng;
  if (lat == null || lng == null) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (Number.isNaN(nLat) || Number.isNaN(nLng)) return null;
  return { lat: nLat, lng: nLng };
}

function cellKey(lat, lng) {
  const rLat = Math.floor(lat / CELL_DEG);
  const rLng = Math.floor(lng / CELL_DEG);
  return `${rLat}:${rLng}`;
}

function cellCenter(key) {
  const [rLat, rLng] = key.split(':').map(Number);
  return {
    lat: (rLat + 0.5) * CELL_DEG,
    lng: (rLng + 0.5) * CELL_DEG,
  };
}

function intensityColor(count, maxCount) {
  const t = maxCount <= 1 ? 1 : Math.min(1, count / maxCount);
  if (t >= 0.75) return { fill: '#dc2626', stroke: '#991b1b', label: 'very_hot' };
  if (t >= 0.5) return { fill: '#ea580c', stroke: '#c2410c', label: 'hot' };
  if (t >= 0.3) return { fill: '#f59e0b', stroke: '#d97706', label: 'warm' };
  return { fill: '#eab308', stroke: '#ca8a04', label: 'mild' };
}

/**
 * @param {{ lat?: number, lng?: number, radius_km?: number }=} opts
 */
export async function getDemandZones(opts = {}) {
  const radiusKm = opts.radius_km != null ? Number(opts.radius_km) : null;
  const originLat = opts.lat != null ? Number(opts.lat) : null;
  const originLng = opts.lng != null ? Number(opts.lng) : null;

  const orders = await localDb.entities.Order.list('-created_date', 300);
  const open = orders.filter((o) => {
    if (o.driver_email || o.is_pickup) return false;
    const status = normalizeOrderStatus(o.status);
    return OPEN_STATUSES.has(status);
  });

  const points = [];
  for (const o of open) {
    const coords = pickupCoords(o);
    if (!coords) continue;
    if (originLat != null && originLng != null && radiusKm != null && radiusKm > 0) {
      const dKm = haversine(originLat, originLng, coords.lat, coords.lng);
      if (dKm > radiusKm) continue;
    }
    points.push({
      ...coords,
      order_id: o.id,
      shop_name: o.shop_name || o.pickup_address || 'Pickup',
      driver_earning: Number(o.driver_earning || 0),
      order_kind: o.order_kind || null,
      required_vehicle_type:
        o.required_vehicle_type ||
        o.pack_progress?.courier_meta?.required_vehicle_type ||
        null,
    });
  }

  const buckets = new Map();
  for (const p of points) {
    const key = cellKey(p.lat, p.lng);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        key,
        count: 0,
        total_earning: 0,
        order_ids: [],
        sample_names: [],
      };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    bucket.total_earning += p.driver_earning;
    bucket.order_ids.push(p.order_id);
    if (bucket.sample_names.length < 3 && p.shop_name) {
      bucket.sample_names.push(p.shop_name);
    }
  }

  const maxCount = Math.max(1, ...[...buckets.values()].map((b) => b.count));
  const zones = [...buckets.values()]
    .map((b) => {
      const center = cellCenter(b.key);
      const color = intensityColor(b.count, maxCount);
      return {
        id: b.key,
        lat: center.lat,
        lng: center.lng,
        count: b.count,
        total_earning: Math.round(b.total_earning * 100) / 100,
        intensity: Math.round((b.count / maxCount) * 100) / 100,
        level: color.label,
        color: color.fill,
        stroke: color.stroke,
        radius_m: Math.min(900, 350 + b.count * 80),
        sample_names: b.sample_names,
        order_ids: b.order_ids,
      };
    })
    .sort((a, b) => b.count - a.count);

  let surge = { multiplier: 1, active: false, reason: null, source: null };
  try {
    surge = calcSurgeMultiplier();
  } catch {
    /* ignore */
  }

  return {
    generated_at: new Date().toISOString(),
    open_jobs: points.length,
    zones,
    points: points.map(({ lat, lng, order_id, shop_name, driver_earning, order_kind, required_vehicle_type }) => ({
      lat,
      lng,
      order_id,
      shop_name,
      driver_earning,
      order_kind,
      required_vehicle_type,
    })),
    surge,
  };
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

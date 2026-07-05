/**
 * MerchantDiscoveryService — geo-based merchant listing (PART 4).
 */
import { query, isPostgresEnabled } from '../../db/pg.js';
import { haversineKm, quoteDelivery, isWithinRadius } from './distanceService.js';

const SORT_HANDLERS = {
  nearest: (a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999),
  fastest: (a, b) => (a.estimated_delivery_mins ?? 999) - (b.estimated_delivery_mins ?? 999),
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  popular: (a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0),
  lowest_fee: (a, b) => (a.delivery_fee ?? 999) - (b.delivery_fee ?? 999),
};

async function fetchMerchantsFromPg() {
  const r = await query(
    `SELECT m.*, b.delivery_radius_km, b.lat AS branch_lat, b.lng AS branch_lng,
            b.pickup_lat, b.pickup_lng, b.operating_hours AS branch_hours
     FROM merchants m
     LEFT JOIN merchant_branches b ON b.id = m.default_branch_id
     WHERE m.approval_status = 'approved'`
  );
  return r.rows;
}

async function fetchMerchantsFromJson(localDb) {
  const shops = await localDb.entities.Shop.list('-created_date', 200);
  return shops.filter((s) => s.approval_status === 'approved');
}

function enrichMerchant(row, customerLat, customerLng) {
  const lat = row.pickup_lat ?? row.branch_lat ?? row.lat;
  const lng = row.pickup_lng ?? row.branch_lng ?? row.lng;
  const radius = row.delivery_radius_km != null ? Number(row.delivery_radius_km) : 8;

  let distance_km = null;
  let delivery_fee = null;
  let estimated_delivery_mins = null;
  let deliverable = true;

  if (customerLat != null && customerLng != null && lat != null && lng != null) {
    distance_km = parseFloat(haversineKm(customerLat, customerLng, Number(lat), Number(lng)).toFixed(2));
    const quote = quoteDelivery(distance_km);
    delivery_fee = quote.delivery_fee;
    estimated_delivery_mins = quote.estimated_delivery_mins;
    deliverable = isWithinRadius(customerLat, customerLng, Number(lat), Number(lng), radius);
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category_id || row.category,
    image_url: row.image_url,
    rating: row.rating != null ? Number(row.rating) : 0,
    rating_count: row.rating_count || 0,
    is_open: row.is_open,
    opening_hours: row.opening_hours || row.branch_hours,
    address: row.address,
    city: row.city,
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    delivery_radius_km: radius,
    distance_km,
    delivery_fee,
    estimated_delivery_mins,
    estimated_delivery_time: row.estimated_delivery_time || (estimated_delivery_mins ? `${estimated_delivery_mins} min` : null),
    deliverable,
    min_order_amount: row.min_order_amount != null ? Number(row.min_order_amount) : 0,
  };
}

export async function discoverMerchants({ lat, lng, sort = 'nearest', limit = 50, category, localDb } = {}) {
  let rows;
  if (isPostgresEnabled()) {
    rows = await fetchMerchantsFromPg();
  } else if (localDb) {
    rows = await fetchMerchantsFromJson(localDb);
  } else {
    rows = [];
  }

  if (category) {
    rows = rows.filter((r) => (r.category_id || r.category) === category);
  }

  let merchants = rows.map((row) => enrichMerchant(row, lat, lng));

  if (lat != null && lng != null) {
    merchants = merchants.filter((m) => m.deliverable !== false);
  }

  const sorter = SORT_HANDLERS[sort] || SORT_HANDLERS.nearest;
  merchants.sort(sorter);

  return merchants.slice(0, limit);
}

export async function getMerchantDeliveryQuote(merchantId, customerLat, customerLng, localDb) {
  const results = await discoverMerchants({ lat: customerLat, lng: customerLng, limit: 200, localDb });
  return results.find((m) => m.id === merchantId) || null;
}

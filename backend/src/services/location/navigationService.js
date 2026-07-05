/**
 * NavigationService — routing placeholders (PART 5 / 7).
 * OSRM polyline when available; Google Directions when configured.
 */
import { getMapsConfig } from './config.js';
import { query, isPostgresEnabled } from '../../db/pg.js';
import { haversineKm } from './distanceService.js';

function decodeOsrmGeometry(geometry) {
  // OSRM returns GeoJSON LineString coordinates [[lng,lat],...]
  if (Array.isArray(geometry)) return geometry.map(([lng, lat]) => ({ lat, lng }));
  return [];
}

async function fetchOsrmRoute(origin, destination) {
  const cfg = getMapsConfig();
  const url = `${cfg.osrm.baseUrl}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;
  const coords = route.geometry?.coordinates || [];
  return {
    polyline: coords.map(([lng, lat]) => ({ lat, lng })),
    distance_km: parseFloat((route.distance / 1000).toFixed(2)),
    duration_mins: Math.max(1, Math.round(route.duration / 60)),
    provider: 'osrm',
  };
}

// TODO(Google Directions API): turn-by-turn + traffic when GOOGLE_DIRECTIONS_ENABLED=1
async function fetchGoogleDirections(_origin, _destination) {
  throw new Error('Google Directions not configured');
}

export async function getRoute(origin, destination, { routeType = 'to_customer' } = {}) {
  const cfg = getMapsConfig();
  let route;
  if (cfg.google.directionsApi) {
    route = await fetchGoogleDirections(origin, destination);
  } else {
    route = await fetchOsrmRoute(origin, destination);
  }

  if (!route) {
    const km = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
    route = {
      polyline: [origin, destination],
      distance_km: parseFloat(km.toFixed(2)),
      duration_mins: Math.max(15, Math.round(km * 4)),
      provider: 'haversine',
    };
  }

  return { ...route, route_type: routeType };
}

export async function saveOrderRoute(orderId, driverEmail, route) {
  if (!isPostgresEnabled()) return route;
  const existing = await query('SELECT id FROM delivery_routes WHERE order_id = $1 AND route_type = $2', [
    orderId,
    route.route_type || 'to_customer',
  ]);
  if (existing.rows[0]) {
    await query(
      `UPDATE delivery_routes SET polyline = $1::jsonb, distance_km = $2, duration_mins = $3, provider = $4, driver_email = $5, updated_at = NOW()
       WHERE id = $6`,
      [
        JSON.stringify(route.polyline || []),
        route.distance_km,
        route.duration_mins,
        route.provider,
        driverEmail || null,
        existing.rows[0].id,
      ]
    );
    return route;
  }

  await query(
    `INSERT INTO delivery_routes (order_id, driver_email, route_type, polyline, distance_km, duration_mins, provider)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)`,
    [
      orderId,
      driverEmail || null,
      route.route_type || 'to_customer',
      JSON.stringify(route.polyline || []),
      route.distance_km,
      route.duration_mins,
      route.provider,
    ]
  );
  return route;
}

export async function getOrderRoutes(orderId) {
  if (!isPostgresEnabled()) return [];
  const r = await query('SELECT * FROM delivery_routes WHERE order_id = $1 ORDER BY created_at ASC', [orderId]);
  return r.rows.map((row) => ({
    id: row.id,
    route_type: row.route_type,
    polyline: row.polyline || [],
    distance_km: row.distance_km != null ? Number(row.distance_km) : null,
    duration_mins: row.duration_mins,
    provider: row.provider,
  }));
}

export function getExternalNavigationUrl(origin, destination, provider = 'google') {
  const dest = `${destination.lat},${destination.lng}`;
  if (provider === 'waze') {
    return `https://waze.com/ul?ll=${dest}&navigate=yes`;
  }
  // TODO(Google Maps deep link): use Maps SDK navigation when embedded
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

// TODO(Voice Navigation): integrate with device TTS / Google Maps voice when native app ships

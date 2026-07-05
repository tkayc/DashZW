/**
 * DriverTrackingService — live driver GPS + history (PART 6 / 7 / 8).
 */
import { query, isPostgresEnabled } from '../../db/pg.js';
import { getMeta, setMeta } from '../../db/store.js';
import { notifyListeners } from '../../db/store.js';

export async function updateDriverLocation(driverEmail, driverUserId, payload) {
  const { lat, lng, order_id, speed_kmh, heading, accuracy_m } = payload;
  if (lat == null || lng == null) throw new Error('lat and lng are required');

  if (isPostgresEnabled()) {
    await query(
      `UPDATE driver_profiles SET current_lat = $1, current_lng = $2, updated_at = NOW() WHERE email = $3`,
      [lat, lng, driverEmail]
    );
    await query(
      `INSERT INTO driver_location_history (driver_user_id, driver_email, order_id, lat, lng, speed_kmh, heading, accuracy_m)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [driverUserId || null, driverEmail, order_id || null, lat, lng, speed_kmh ?? null, heading ?? null, accuracy_m ?? null]
    );
    if (order_id) {
      await query(
        `UPDATE orders SET driver_lat = $1, driver_lng = $2, tracking_updated_at = NOW() WHERE id = $3`,
        [lat, lng, order_id]
      );
      notifyListeners('Order');
    }
    notifyListeners('DriverProfile');
  } else {
    setMeta(`driver_loc_${driverEmail}`, { lat, lng, order_id, updated_at: new Date().toISOString() });
    if (order_id) notifyListeners('Order');
  }

  return { lat, lng, order_id, recorded_at: new Date().toISOString() };
}

export async function getDriverLocation(driverEmail) {
  if (!isPostgresEnabled()) {
    return getMeta(`driver_loc_${driverEmail}`) || null;
  }
  const r = await query(
    'SELECT current_lat AS lat, current_lng AS lng, updated_at FROM driver_profiles WHERE email = $1',
    [driverEmail]
  );
  const row = r.rows[0];
  if (!row?.lat) return null;
  return { lat: Number(row.lat), lng: Number(row.lng), updated_at: row.updated_at };
}

export async function getDriverLocationHistory(orderId, limit = 100) {
  if (!isPostgresEnabled()) return [];
  const r = await query(
    `SELECT lat, lng, speed_kmh, heading, recorded_at FROM driver_location_history
     WHERE order_id = $1 ORDER BY recorded_at DESC LIMIT $2`,
    [orderId, limit]
  );
  return r.rows.map((row) => ({
    lat: Number(row.lat),
    lng: Number(row.lng),
    speed_kmh: row.speed_kmh != null ? Number(row.speed_kmh) : null,
    heading: row.heading != null ? Number(row.heading) : null,
    recorded_at: row.recorded_at,
  }));
}

export async function listActiveDrivers() {
  if (!isPostgresEnabled()) return [];
  const r = await query(
    `SELECT dp.email, dp.current_lat AS lat, dp.current_lng AS lng, dp.is_online, dp.updated_at,
            u.full_name AS driver_name
     FROM driver_profiles dp
     JOIN users u ON u.id = dp.user_id
     WHERE dp.is_online = TRUE AND dp.current_lat IS NOT NULL`
  );
  return r.rows.map((row) => ({
    driver_email: row.email,
    driver_name: row.driver_name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    is_online: row.is_online,
    updated_at: row.updated_at,
  }));
}

export async function recordTrackingEvent(orderId, event) {
  if (!isPostgresEnabled()) return event;
  await query(
    `INSERT INTO order_tracking_events (order_id, status, title, description, lat, lng, actor_type, actor_email, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [
      orderId,
      event.status,
      event.title || null,
      event.description || null,
      event.lat ?? null,
      event.lng ?? null,
      event.actor_type || 'system',
      event.actor_email || null,
      JSON.stringify(event.metadata || {}),
    ]
  );
  return event;
}

export async function getOrderTrackingTimeline(orderId) {
  if (!isPostgresEnabled()) return [];
  const r = await query(
    `SELECT status, title, description, lat, lng, actor_type, actor_email, created_at
     FROM order_tracking_events WHERE order_id = $1 ORDER BY created_at ASC`,
    [orderId]
  );
  return r.rows;
}

export async function getLiveOperationsSnapshot(filters = {}) {
  if (!isPostgresEnabled()) return { drivers: [], orders: [], merchants: [] };

  const { city, merchant_id, driver_email, status, date } = filters;

  let orderSql = `
    SELECT o.id, o.status, o.shop_name, o.delivery_address, o.delivery_city,
           o.shop_lat, o.shop_lng, o.dest_lat, o.dest_lng, o.driver_lat, o.driver_lng,
           o.driver_email, o.driver_name, o.tracking_eta_mins, o.tracking_updated_at,
           o.merchant_id, o.created_at AS created_date
    FROM orders o
    WHERE o.status NOT IN ('completed', 'cancelled', 'refunded', 'delivered')
  `;
  const params = [];
  let i = 1;
  if (city) { orderSql += ` AND LOWER(o.delivery_city) = LOWER($${i++})`; params.push(city); }
  if (merchant_id) { orderSql += ` AND o.merchant_id = $${i++}`; params.push(merchant_id); }
  if (driver_email) { orderSql += ` AND LOWER(o.driver_email) = LOWER($${i++})`; params.push(driver_email); }
  if (status) { orderSql += ` AND o.status = $${i++}`; params.push(status); }
  if (date) { orderSql += ` AND o.created_at::date = $${i++}::date`; params.push(date); }

  const [drivers, orders, merchants] = await Promise.all([
    listActiveDrivers(),
    query(orderSql, params),
    query(`SELECT id, name, lat, lng, city, is_open, pickup_lat, pickup_lng FROM merchants WHERE approval_status = 'approved'`),
  ]);

  return {
    drivers,
    orders: orders.rows,
    merchants: merchants.rows.map((m) => ({
      ...m,
      lat: m.pickup_lat ?? m.lat,
      lng: m.pickup_lng ?? m.lng,
    })),
  };
}

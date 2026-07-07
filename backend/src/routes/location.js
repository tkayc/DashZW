/**
 * Location API routes — addresses, geocoding, discovery, tracking, navigation.
 */
import { Router } from 'express';
import { authMiddleware, optionalAuth } from '../services/authentication/middleware.js';
import { localDb } from '../db/localDb.js';
import {
  getMapsConfig,
  geocodeAddress,
  reverseGeocode,
  searchPlaces,
  quoteDelivery,
  roadDistance,
  listAddresses,
  getDefaultAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  saveCurrentLocationAsAddress,
  discoverMerchants,
  getMerchantDeliveryQuote,
  updateDriverLocation,
  getDriverLocation,
  getDriverLocationHistory,
  getOrderTrackingTimeline,
  getLiveOperationsSnapshot,
  getRoute,
  saveOrderRoute,
  getOrderRoutes,
  getExternalNavigationUrl,
  recordTrackingEvent,
} from '../services/location/index.js';

const router = Router();

function userEmail(req) {
  return (req.user?.email || '').toLowerCase();
}

function isAdmin(user) {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

function isDriver(user) {
  return user?.role === 'driver';
}

function isPartner(user) {
  return user?.role === 'partner';
}

// Public maps config (no secrets)
router.get('/config', (_req, res) => {
  const cfg = getMapsConfig();
  res.json({
    provider: cfg.provider,
    google: {
      mapsSdk: cfg.google.mapsSdk,
      placesApi: cfg.google.placesApi,
      directionsApi: cfg.google.directionsApi,
    },
    openstreetmap: { tileUrl: cfg.openstreetmap.tileUrl },
    defaults: cfg.defaults,
  });
});

// Public merchant discovery (browse without login)
router.get('/merchants/discover', optionalAuth, async (req, res) => {
  try {
    const lat = req.query.lat != null ? Number(req.query.lat) : null;
    const lng = req.query.lng != null ? Number(req.query.lng) : null;
    const sort = req.query.sort || 'nearest';
    const limit = parseInt(req.query.limit, 10) || 50;
    const category = req.query.category || null;
    const merchants = await discoverMerchants({ lat, lng, sort, limit, category, localDb });
    res.json(merchants);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.use(authMiddleware);

// ── Geocoding ────────────────────────────────────────────────────────────────
router.post('/geocode', async (req, res) => {
  try {
    const { address, city, country } = req.body || {};
    if (!address?.trim()) return res.status(400).json({ message: 'address is required' });
    const result = await geocodeAddress(address, { city, country });
    if (!result) return res.status(404).json({ message: 'Address not found' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/reverse-geocode', async (req, res) => {
  try {
    const { lat, lng } = req.body || {};
    if (lat == null || lng == null) return res.status(400).json({ message: 'lat and lng are required' });
    const result = await reverseGeocode(Number(lat), Number(lng));
    if (!result) return res.status(404).json({ message: 'Location not found' });
    res.json(result);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/places/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) return res.json([]);
    const results = await searchPlaces(q, {
      limit: parseInt(req.query.limit, 10) || 5,
      city: req.query.city,
      country: req.query.country,
    });
    res.json(results);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Distance quote ───────────────────────────────────────────────────────────
router.post('/quote', async (req, res) => {
  try {
    const { origin, destination, distance_km } = req.body || {};
    if (distance_km != null) {
      return res.json(quoteDelivery(Number(distance_km)));
    }
    if (!origin?.lat || !destination?.lat) {
      return res.status(400).json({ message: 'origin and destination required' });
    }
    const road = await roadDistance(origin, destination);
    res.json({ ...road, ...quoteDelivery(road.distance_km) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Addresses (customer) ─────────────────────────────────────────────────────
router.get('/addresses', async (req, res) => {
  try {
    res.json(await listAddresses(userEmail(req)));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get('/addresses/default', async (req, res) => {
  try {
    res.json(await getDefaultAddress(userEmail(req)) || null);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/addresses', async (req, res) => {
  try {
    const created = await createAddress(userEmail(req), req.body || {});
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.post('/addresses/current-location', async (req, res) => {
  try {
    const { lat, lng, ...rest } = req.body || {};
    if (lat == null || lng == null) return res.status(400).json({ message: 'lat and lng required' });
    const created = await saveCurrentLocationAsAddress(userEmail(req), { lat: Number(lat), lng: Number(lng), ...rest });
    res.status(201).json(created);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.patch('/addresses/:id', async (req, res) => {
  try {
    res.json(await updateAddress(userEmail(req), req.params.id, req.body || {}));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.post('/addresses/:id/default', async (req, res) => {
  try {
    res.json(await setDefaultAddress(userEmail(req), req.params.id));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.delete('/addresses/:id', async (req, res) => {
  try {
    res.json(await deleteAddress(userEmail(req), req.params.id));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});


// ── Merchant discovery (authenticated quote) ───────────────────────────────────
router.get('/merchants/:id/quote', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ message: 'lat and lng query params required' });
    }
    const quote = await getMerchantDeliveryQuote(req.params.id, lat, lng, localDb);
    if (!quote) return res.status(404).json({ message: 'Merchant not found' });
    res.json(quote);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Driver tracking ──────────────────────────────────────────────────────────
router.post('/drivers/me/location', async (req, res) => {
  if (!isDriver(req.user)) return res.status(403).json({ message: 'Drivers only' });
  try {
    const result = await updateDriverLocation(userEmail(req), req.user.id, req.body || {});
    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get('/drivers/:email/location', async (req, res) => {
  try {
    res.json(await getDriverLocation(req.params.email.toLowerCase()) || null);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Order tracking ───────────────────────────────────────────────────────────
router.get('/orders/:id/tracking', async (req, res) => {
  try {
    const [timeline, routes, history] = await Promise.all([
      getOrderTrackingTimeline(req.params.id),
      getOrderRoutes(req.params.id),
      getDriverLocationHistory(req.params.id, 50),
    ]);
    const orders = await localDb.entities.Order.filter({ id: req.params.id }, '-created_date', 1);
    const order = orders[0];
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({
      order_id: req.params.id,
      status: order.status,
      merchant: { lat: order.shop_lat, lng: order.shop_lng, name: order.shop_name, address: order.shop_address },
      customer: { lat: order.dest_lat, lng: order.dest_lng, address: order.delivery_address },
      driver: {
        email: order.driver_email,
        name: order.driver_name,
        lat: order.driver_lat,
        lng: order.driver_lng,
        phone: order.driver_phone,
      },
      eta_mins: order.tracking_eta_mins || order.estimated_arrival_mins,
      timeline,
      routes,
      location_history: history,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post('/orders/:id/route', async (req, res) => {
  if (!isDriver(req.user) && !isAdmin(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const { origin, destination, route_type } = req.body || {};
    const route = await getRoute(origin, destination, { routeType: route_type });
    await saveOrderRoute(req.params.id, userEmail(req), route);
    await recordTrackingEvent(req.params.id, {
      status: route_type || 'route_calculated',
      title: 'Route updated',
      actor_type: isDriver(req.user) ? 'driver' : 'system',
      actor_email: userEmail(req),
    });
    res.json(route);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get('/navigation/url', (req, res) => {
  const destLat = Number(req.query.dest_lat);
  const destLng = Number(req.query.dest_lng);
  if (Number.isNaN(destLat) || Number.isNaN(destLng)) {
    return res.status(400).json({ message: 'dest_lat and dest_lng required' });
  }
  const url = getExternalNavigationUrl(
    null,
    { lat: destLat, lng: destLng },
    req.query.provider || 'google'
  );
  res.json({ url });
});

// ── Admin / partner live ops ─────────────────────────────────────────────────
router.get('/live-ops', async (req, res) => {
  if (!isAdmin(req.user) && !isPartner(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  try {
    const snapshot = await getLiveOperationsSnapshot({
      city: req.query.city,
      merchant_id: req.query.merchant_id,
      driver_email: req.query.driver_email,
      status: req.query.status,
      date: req.query.date,
    });
    if (isPartner(req.user)) {
      const shops = await localDb.entities.Shop.filter({ owner_email: userEmail(req) }, '-created_date', 5);
      const shopIds = new Set(shops.map((s) => s.id));
      snapshot.orders = snapshot.orders.filter((o) => shopIds.has(o.merchant_id || o.shop_id));
      snapshot.merchants = snapshot.merchants.filter((m) => shopIds.has(m.id));
    }
    res.json(snapshot);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;

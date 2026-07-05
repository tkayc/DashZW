# DashZW Location & Maps Architecture — Implementation Report

Generated: July 2026

## 1. Files modified

### Backend
| File | Change |
|------|--------|
| `backend/src/index.js` | Mount `/api/location` routes |
| `backend/.env` | Maps env vars (Google/OSRM/OSM placeholders) |
| `backend/src/db/pgEntities.js` | Branch update map (`delivery_radius_km`, pickup coords) |
| `backend/sql/README_POSTGRES.md` | Step 1c for migration 004 |

### Customer app
| File | Change |
|------|--------|
| `frontends/customer/src/App.jsx` | `LocationProvider` |
| `frontends/customer/src/lib/LocationContext.jsx` | GPS + saved address orchestration |
| `frontends/customer/src/components/layout/AppLayout.jsx` | “Delivering to” bar |
| `frontends/customer/src/pages/Home.jsx` | Geo-based merchant discovery + sort |
| `frontends/customer/src/pages/Checkout.jsx` | Delivery coords, saved addresses, radius quote |
| `frontends/customer/src/pages/account/Addresses.jsx` | Full CRUD + map pin |
| `frontends/customer/src/pages/OrderDetail.jsx` | Live tracking map + call/chat placeholders |
| `frontends/customer/src/components/shared/ShopCard.jsx` | Distance + delivery fee |
| `frontends/customer/src/api/index.js` | Export location module |

### Driver app
| File | Change |
|------|--------|
| `frontends/driver/src/hooks/useDriverLocation.js` | Backend GPS API + order sync |
| `frontends/driver/src/pages/DriverActiveDeliveries.jsx` | Navigate → `/navigate/:orderId` |
| `frontends/driver/src/pages/DriverNavigation.jsx` | **New** — workflow + OSRM route |
| `frontends/driver/src/App.jsx` | Navigation route |

### Admin app
| File | Change |
|------|--------|
| `frontends/admin/src/pages/AdminLiveMap.jsx` | **New** — live ops map |
| `frontends/admin/src/App.jsx` | `/live-map` route |

### Partner app
| File | Change |
|------|--------|
| `frontends/partner/src/pages/PartnerLiveMap.jsx` | **New** — driver tracking + radius |
| `frontends/partner/src/App.jsx` | `/delivery-map` route |

### Shared / config
| File | Change |
|------|--------|
| `frontends/vite.config.base.js` | `@location` alias → `frontends/shared/location` |

---

## 2. New services created

### Backend (`backend/src/services/location/`)
| Service | Purpose |
|---------|---------|
| `config.js` | Maps provider config from env (Google + OSM) |
| `geocodingService.js` | Forward/reverse geocode, place search (Nominatim; Google TODO) |
| `distanceService.js` | Haversine, delivery quote, radius check |
| `addressService.js` | Customer address CRUD + current-location save |
| `driverTrackingService.js` | Live driver GPS, history, admin snapshot |
| `merchantDiscoveryService.js` | Geo merchant listing + sort |
| `navigationService.js` | OSRM routes, external nav URLs (Google Directions TODO) |

### Frontend shared (`frontends/shared/location/`)
| Service | Purpose |
|---------|---------|
| `LocationService` | First-open GPS + default address |
| `PermissionService` | Browser geolocation permission |
| `AddressService` | Address API wrapper |
| `GeocodingService` | Geocode API wrapper |
| `DistanceService` | Discovery + quote wrapper |
| `NavigationService` | Routes + external maps |
| `PlatformMap.jsx` | Reusable Leaflet map (Google Maps SDK TODO) |

---

## 3. New models / database objects

Run: `backend/sql/004_location_architecture.sql`

| Object | Description |
|--------|-------------|
| `user_addresses` (extended) | suburb, province, country, postal_code, building, apt, floor, phone, recipient |
| `driver_location_history` | GPS audit trail per driver/order |
| `delivery_routes` | Route polylines (OSRM/Google) |
| `order_tracking_events` | Status timeline with optional lat/lng |
| `merchants` / `merchant_branches` | `pickup_lat`, `pickup_lng` |
| `orders` | `tracking_eta_mins`, `tracking_updated_at` |
| `platform_config.maps_provider` | Provider configuration JSON |

Demo address seeded: **15 Kingsway Avenue, Auckland Park, Johannesburg** (-26.1823, 27.9985) for `customer@demo.com`.

---

## 4. API implementation

Base path: `/api/location` and `/api/v1/location`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/config` | Public | Maps provider config (no secrets) |
| POST | `/geocode` | User | Forward geocode |
| POST | `/reverse-geocode` | User | Reverse geocode GPS |
| GET | `/places/search?q=` | User | Address autocomplete (OSM; Places TODO) |
| POST | `/quote` | User | Distance + delivery fee |
| GET | `/addresses` | User | List saved addresses |
| GET | `/addresses/default` | User | Default address |
| POST | `/addresses` | User | Create address |
| PATCH | `/addresses/:id` | User | Update address |
| DELETE | `/addresses/:id` | User | Delete address |
| POST | `/addresses/current-location` | User | Save GPS as address |
| GET | `/merchants/discover?lat=&lng=&sort=` | User | Geo merchant discovery |
| GET | `/merchants/:id/quote?lat=&lng=` | User | Per-merchant delivery quote |
| POST | `/drivers/me/location` | Driver | Broadcast GPS |
| GET | `/orders/:id/tracking` | User | Live tracking payload |
| POST | `/orders/:id/route` | Driver/Admin | Calculate + store route |
| GET | `/navigation/url` | User | External maps deep link |
| GET | `/live-ops` | Admin/Partner | Fleet snapshot |

**Sort options:** `nearest`, `fastest`, `rating`, `popular`, `lowest_fee`

---

## 5. Environment variables

```env
GOOGLE_MAPS_API_KEY=
GOOGLE_PLACES_ENABLED=0
GOOGLE_DIRECTIONS_ENABLED=0
GOOGLE_GEOCODING_ENABLED=0
GOOGLE_DISTANCE_MATRIX_ENABLED=0
OSRM_URL=https://router.project-osrm.org
OSM_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
DEFAULT_COUNTRY=South Africa
DEFAULT_CITY=Johannesburg
```

Frontend (optional): `VITE_GOOGLE_MAPS_API_KEY` when switching PlatformMap to Google Maps SDK.

---

## 6. Remaining recommendations

1. **Run migration** — `004_location_architecture.sql` in pgAdmin on database `dashzw`.
2. **Google Maps production** — Set `GOOGLE_MAPS_API_KEY` and enable feature flags; replace Leaflet tile layer with Maps JavaScript SDK in `PlatformMap.jsx`.
3. **WebSocket tracking** — Replace 3–8s polling with SSE/WebSocket channel for driver positions at scale (10k+ concurrent deliveries).
4. **PostGIS** — Add `GEOGRAPHY(POINT)` indexes for sub-millisecond radius queries at very large merchant counts.
5. **Redis geospatial** — Cache active driver positions for admin live map.
6. **Telephony** — Wire “Call driver” to Twilio or native dialer deep links in production.
7. **Voice navigation** — Native app bridge or Google Maps turn-by-turn when embedded SDK is enabled.
8. **Offline mode** — Service worker + cached tiles (PlatformMap already shows offline placeholder).
9. **Rate limiting** — Nominatim/OSRM proxy with Redis rate limits on backend geocode endpoints.
10. **Checkout UI** — Add visible “Deliver to current / new / saved” radio group (logic partially wired).

---

## Quick test checklist

1. Run SQL migration 004
2. Restart API (`npm run dev`)
3. Customer: open home → see “Delivering to” bar; merchants show distance
4. Customer: `/addresses` → add/edit/pin on map
5. Customer: checkout → coords persisted on order
6. Driver: active delivery → Navigate → OSRM route
7. Admin: `/live-map` → active drivers/orders
8. Partner: `/delivery-map` → incoming driver + radius config

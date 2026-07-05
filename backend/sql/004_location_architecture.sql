-- DashZW Location & Maps Architecture
-- Run after 001_dashzw_full_schema.sql (and optional 002/003 seeds)
-- psql -U postgres -d dashzw -f backend/sql/004_location_architecture.sql

BEGIN;

-- =============================================================================
-- EXTEND user_addresses (PART 2)
-- =============================================================================

ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS suburb TEXT;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'South Africa';
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS building_name TEXT;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS apartment_number TEXT;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS floor TEXT;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_default ON user_addresses(user_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_addresses_coords ON user_addresses(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- =============================================================================
-- MERCHANT PICKUP / DELIVERY ZONE (PART 9)
-- =============================================================================

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION;
ALTER TABLE merchant_branches ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION;
ALTER TABLE merchant_branches ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION;

-- Sync pickup coords from branch lat/lng where missing
UPDATE merchant_branches SET pickup_lat = lat, pickup_lng = lng
WHERE pickup_lat IS NULL AND lat IS NOT NULL;

UPDATE merchants m SET pickup_lat = b.lat, pickup_lng = b.lng
FROM merchant_branches b
WHERE m.default_branch_id = b.id AND m.pickup_lat IS NULL AND b.lat IS NOT NULL;

-- =============================================================================
-- DRIVER LIVE LOCATION (PART 7 / 8)
-- =============================================================================

CREATE TABLE IF NOT EXISTS driver_location_history (
  id              BIGSERIAL PRIMARY KEY,
  driver_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_email    CITEXT NOT NULL,
  order_id        TEXT REFERENCES orders(id) ON DELETE SET NULL,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  speed_kmh       NUMERIC(6,2),
  heading         NUMERIC(5,2),
  accuracy_m      NUMERIC(8,2),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_loc_history_driver ON driver_location_history(driver_email, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_loc_history_order ON driver_location_history(order_id, recorded_at DESC);

-- =============================================================================
-- DELIVERY ROUTES (PART 6 / 7)
-- =============================================================================

CREATE TABLE IF NOT EXISTS delivery_routes (
  id              TEXT PRIMARY KEY DEFAULT ('route_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_email    CITEXT,
  route_type      TEXT NOT NULL DEFAULT 'to_customer', -- to_merchant | to_customer
  polyline        JSONB NOT NULL DEFAULT '[]'::jsonb,
  distance_km     NUMERIC(8,3),
  duration_mins   INT,
  provider        TEXT NOT NULL DEFAULT 'osrm',
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_routes_order ON delivery_routes(order_id);

-- =============================================================================
-- ORDER TRACKING EVENTS (PART 6)
-- =============================================================================

CREATE TABLE IF NOT EXISTS order_tracking_events (
  id              BIGSERIAL PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status          TEXT NOT NULL,
  title           TEXT,
  description     TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  actor_type      TEXT, -- customer | driver | merchant | system
  actor_email     CITEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_tracking_order ON order_tracking_events(order_id, created_at ASC);

-- =============================================================================
-- ORDER TRACKING SNAPSHOT (live ETA / driver position cache)
-- =============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_eta_mins INT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_updated_at TIMESTAMPTZ;

-- =============================================================================
-- MAPS PLATFORM CONFIG (PART 5)
-- =============================================================================

INSERT INTO platform_config (key, value, description)
VALUES (
  'maps_provider',
  '{
    "provider": "openstreetmap",
    "google_maps_api_key_env": "GOOGLE_MAPS_API_KEY",
    "google_places_enabled": false,
    "google_directions_enabled": false,
    "google_geocoding_enabled": false,
    "google_distance_matrix_enabled": false,
    "osm_tile_url": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "osm_geocode_url": "https://nominatim.openstreetmap.org",
    "osrm_url_env": "OSRM_URL",
    "default_country": "South Africa",
    "default_city": "Johannesburg"
  }'::jsonb,
  'Maps provider configuration — swap to Google Maps via env vars'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- =============================================================================
-- DEMO: Auckland Park delivery address for customer demo account
-- =============================================================================

INSERT INTO user_addresses (
  id, user_id, label, line1, suburb, city, province, country, postal_code,
  lat, lng, instructions, building_name, apartment_number, floor,
  phone, recipient_name, is_default
)
SELECT
  'addr_demo_auckland',
  u.id,
  'Home',
  '15 Kingsway Avenue',
  'Auckland Park',
  'Johannesburg',
  'Gauteng',
  'South Africa',
  '2092',
  -26.1823,
  27.9985,
  'Ring bell at gate',
  'Kingsway Heights',
  '4B',
  '2',
  '+27 82 000 0000',
  'Demo Customer',
  TRUE
FROM users u
WHERE u.email = 'customer@demo.com'
ON CONFLICT (id) DO UPDATE SET
  line1 = EXCLUDED.line1,
  suburb = EXCLUDED.suburb,
  city = EXCLUDED.city,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  is_default = TRUE,
  updated_at = NOW();

COMMIT;

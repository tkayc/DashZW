-- =============================================================================
-- DashZW — Full PostgreSQL schema
--
-- BEFORE RUNNING THIS FILE:
--   1. Run 000_create_database.sql while connected to the "postgres" database
--   2. Disconnect and connect to database "dashzw"
--   3. Paste / run THIS entire file
--
-- psql one-liner (after DB exists):
--   psql -U postgres -d dashzw -f backend/sql/001_dashzw_full_schema.sql
--
-- Covers every domain area used by customer / partner / driver / admin apps.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- =============================================================================
-- ENUMS
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE platform_role AS ENUM (
    'customer', 'driver', 'merchant_owner', 'merchant_manager',
    'merchant_cashier', 'merchant_kitchen', 'merchant_dispatcher',
    'support', 'finance', 'admin', 'super_admin', 'guest',
    'partner' -- legacy alias for merchant_owner
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE merchant_status AS ENUM (
    'draft', 'pending', 'approved', 'rejected', 'suspended', 'active', 'inactive'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE merchant_verification AS ENUM (
    'unverified', 'pending', 'verified', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE branch_status AS ENUM (
    'open', 'closed', 'paused', 'coming_soon'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE staff_role AS ENUM (
    'owner', 'manager', 'cashier', 'kitchen', 'dispatcher'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'created', 'pending_acceptance', 'accepted', 'preparing',
    'ready_for_pickup', 'driver_assigned', 'picked_up', 'in_transit',
    'delivered', 'completed', 'cancelled', 'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE wallet_owner_type AS ENUM (
    'customer', 'driver', 'partner', 'platform'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method_type AS ENUM (
    'ecocash', 'onemoney', 'innbucks', 'cash_on_delivery', 'card', 'wallet'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE promo_type AS ENUM (
    'coupon', 'promo_code', 'merchant_promotion', 'platform_promotion',
    'free_delivery', 'flash_sale', 'loyalty_reward', 'referral_reward',
    'first_order_discount', 'percentage_discount', 'fixed_discount',
    'platform_discount', 'new_user_discount'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM (
    'push', 'sms', 'email', 'in_app'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_category AS ENUM (
    'order_updates', 'promotions', 'announcements', 'wallet', 'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE support_ticket_status AS ENUM (
    'open', 'in_progress', 'resolved', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM (
    'open', 'under_review', 'resolved', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- PLATFORM LOOKUPS
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  description   TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS merchant_categories (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  icon          TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS countries (
  code          CHAR(2) PRIMARY KEY,
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS currencies (
  code          CHAR(3) PRIMARY KEY,
  name          TEXT NOT NULL,
  symbol        TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS languages (
  code          TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS platform_config (
  key           TEXT PRIMARY KEY,
  value         JSONB NOT NULL DEFAULT '{}'::jsonb,
  description   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key           TEXT PRIMARY KEY,
  enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  description   TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surge_config (
  id            TEXT PRIMARY KEY DEFAULT 'default',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  base_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  max_multiplier  NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  active_order_threshold INT NOT NULL DEFAULT 10,
  reason        TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_providers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  is_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- USERS & AUTH
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT ('usr_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  email           CITEXT NOT NULL UNIQUE,
  phone           TEXT,
  password_hash   TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  role            platform_role NOT NULL DEFAULT 'customer',
  staff_role      staff_role, -- optional merchant staff role on user record
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  remember_token  TEXT,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  address         TEXT,
  city            TEXT,
  avatar_url      TEXT,
  locale          TEXT DEFAULT 'en',
  currency        CHAR(3) DEFAULT 'ZAR',
  preferences     JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_addresses (
  id              TEXT PRIMARY KEY DEFAULT ('addr_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           TEXT NOT NULL DEFAULT 'Home',
  line1           TEXT NOT NULL,
  line2           TEXT,
  city            TEXT,
  instructions    TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id              TEXT PRIMARY KEY DEFAULT ('pm_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            payment_method_type NOT NULL,
  label           TEXT,
  provider_ref    TEXT, -- token / msisdn placeholder
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id              TEXT PRIMARY KEY DEFAULT ('otp_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL, -- email | phone
  destination     TEXT NOT NULL,
  code_hash       TEXT NOT NULL,
  purpose         TEXT NOT NULL, -- login | reset | verify
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id              TEXT PRIMARY KEY DEFAULT ('prt_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id              TEXT PRIMARY KEY DEFAULT ('evt_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MERCHANTS / BRANCHES / STAFF
-- =============================================================================

CREATE TABLE IF NOT EXISTS merchants (
  id                  TEXT PRIMARY KEY DEFAULT ('mrc_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  name                TEXT NOT NULL,
  description         TEXT,
  category_id         TEXT REFERENCES merchant_categories(id),
  image_url           TEXT,
  cover_url           TEXT,
  brand_color         TEXT,
  phone               TEXT,
  owner_user_id       TEXT REFERENCES users(id),
  owner_email         CITEXT NOT NULL,
  approval_status     merchant_status NOT NULL DEFAULT 'pending',
  verification_status merchant_verification NOT NULL DEFAULT 'unverified',
  rating              NUMERIC(3,2) DEFAULT 0,
  rating_count        INT NOT NULL DEFAULT 0,
  is_open             BOOLEAN NOT NULL DEFAULT TRUE,
  opening_hours       TEXT,
  min_order_amount    NUMERIC(12,2) DEFAULT 0,
  address             TEXT,
  city                TEXT,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  estimated_delivery_time TEXT,
  default_branch_id   TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_branches (
  id                      TEXT PRIMARY KEY DEFAULT ('brn_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  merchant_id             TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL DEFAULT 'Main',
  address                 TEXT,
  city                    TEXT,
  phone                   TEXT,
  lat                     DOUBLE PRECISION,
  lng                     DOUBLE PRECISION,
  operating_hours         TEXT,
  manager_user_id         TEXT REFERENCES users(id),
  manager_email           CITEXT,
  delivery_radius_km      NUMERIC(6,2) NOT NULL DEFAULT 8,
  estimated_delivery_time TEXT,
  status                  branch_status NOT NULL DEFAULT 'open',
  is_open                 BOOLEAN NOT NULL DEFAULT TRUE,
  is_default              BOOLEAN NOT NULL DEFAULT FALSE,
  images                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  analytics               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE merchants
  DROP CONSTRAINT IF EXISTS merchants_default_branch_fk;
ALTER TABLE merchants
  ADD CONSTRAINT merchants_default_branch_fk
  FOREIGN KEY (default_branch_id) REFERENCES merchant_branches(id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS merchant_staff (
  id              TEXT PRIMARY KEY DEFAULT ('stf_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  merchant_id     TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  branch_id       TEXT REFERENCES merchant_branches(id) ON DELETE SET NULL,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_email      CITEXT NOT NULL,
  staff_role      staff_role NOT NULL DEFAULT 'owner',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, user_email)
);

CREATE TABLE IF NOT EXISTS merchant_documents (
  id              TEXT PRIMARY KEY DEFAULT ('doc_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  merchant_id     TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  doc_type        TEXT NOT NULL, -- business_registration, tax_clearance, id_document, bank_proof, food_hygiene
  file_url        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  notes           TEXT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchant_branding (
  merchant_id     TEXT PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  logo_url        TEXT,
  cover_url       TEXT,
  primary_color   TEXT,
  tagline         TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CATALOG / INVENTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS product_categories (
  id              TEXT PRIMARY KEY DEFAULT ('pcat_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  merchant_id     TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (merchant_id, name)
);

CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY DEFAULT ('prd_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  merchant_id     TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  branch_id       TEXT REFERENCES merchant_branches(id) ON DELETE SET NULL,
  category_id     TEXT REFERENCES product_categories(id) ON DELETE SET NULL,
  category_name   TEXT, -- denormalized label (legacy MenuItem.category)
  name            TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  image_url       TEXT,
  sku             TEXT,
  barcode         TEXT,
  is_popular      BOOLEAN NOT NULL DEFAULT FALSE,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  prep_minutes    INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_images (
  id              TEXT PRIMARY KEY DEFAULT ('pimg_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_variants (
  id              TEXT PRIMARY KEY DEFAULT ('pvar_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price_delta     NUMERIC(12,2) NOT NULL DEFAULT 0,
  sku             TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS product_addons (
  id              TEXT PRIMARY KEY DEFAULT ('padd_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price           NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS product_modifiers (
  id              TEXT PRIMARY KEY DEFAULT ('pmod_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  options         JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS product_nutrition (
  product_id      TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  calories        INT,
  protein_g       NUMERIC(8,2),
  carbs_g         NUMERIC(8,2),
  fat_g           NUMERIC(8,2),
  notes           TEXT
);

CREATE TABLE IF NOT EXISTS product_allergens (
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  allergen        TEXT NOT NULL,
  PRIMARY KEY (product_id, allergen)
);

CREATE TABLE IF NOT EXISTS inventory (
  id              TEXT PRIMARY KEY DEFAULT ('inv_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  merchant_id     TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  branch_id       TEXT REFERENCES merchant_branches(id) ON DELETE CASCADE,
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id      TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity        INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (branch_id, product_id, variant_id)
);

-- =============================================================================
-- ORDERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id                    TEXT PRIMARY KEY DEFAULT ('ord_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  customer_user_id      TEXT REFERENCES users(id),
  customer_email        CITEXT NOT NULL,
  customer_name         TEXT,
  customer_phone        TEXT,
  merchant_id           TEXT NOT NULL REFERENCES merchants(id),
  merchant_name         TEXT,
  merchant_category     TEXT,
  branch_id             TEXT REFERENCES merchant_branches(id),
  partner_email         CITEXT,
  -- legacy aliases kept for API compatibility
  shop_id               TEXT,
  shop_name             TEXT,
  shop_address          TEXT,
  shop_lat              DOUBLE PRECISION,
  shop_lng              DOUBLE PRECISION,
  status                order_status NOT NULL DEFAULT 'pending_acceptance',
  is_pickup             BOOLEAN NOT NULL DEFAULT FALSE,
  is_scheduled          BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_time        TIMESTAMPTZ,
  delivery_address      TEXT,
  delivery_city         TEXT,
  delivery_notes        TEXT,
  delivery_instructions TEXT,
  special_notes         TEXT,
  dest_lat              DOUBLE PRECISION,
  dest_lng              DOUBLE PRECISION,
  distance_km           NUMERIC(8,2),
  estimated_arrival_mins INT,
  delivery_code         TEXT,
  payment_method        payment_method_type,
  partner_subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee          NUMERIC(12,2) NOT NULL DEFAULT 0,
  customer_subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee          NUMERIC(12,2) NOT NULL DEFAULT 0,
  raw_delivery_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_fee           NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  admin_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  wallet_applied        NUMERIC(12,2) NOT NULL DEFAULT 0,
  driver_tip            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  partner_payout        NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_earning      NUMERIC(12,2) NOT NULL DEFAULT 0,
  driver_earning        NUMERIC(12,2) NOT NULL DEFAULT 0,
  refunded_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_free_delivery      BOOLEAN NOT NULL DEFAULT FALSE,
  promo_id              TEXT,
  promo_title           TEXT,
  admin_promo_id        TEXT,
  admin_promo_title     TEXT,
  driver_user_id        TEXT REFERENCES users(id),
  driver_email          CITEXT,
  driver_name           TEXT,
  driver_phone          TEXT,
  driver_lat            DOUBLE PRECISION,
  driver_lng            DOUBLE PRECISION,
  pack_progress         JSONB NOT NULL DEFAULT '{}'::jsonb,
  cancel_reason         TEXT,
  delivered_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id                  TEXT PRIMARY KEY DEFAULT ('oit_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id          TEXT,
  menu_item_id        TEXT, -- legacy
  name                TEXT NOT NULL,
  price               NUMERIC(12,2) NOT NULL,
  quantity            INT NOT NULL CHECK (quantity > 0),
  packed_quantity     INT NOT NULL DEFAULT 0,
  variant_id          TEXT,
  variant_name        TEXT,
  addon_ids           JSONB NOT NULL DEFAULT '[]'::jsonb,
  addon_names         JSONB NOT NULL DEFAULT '[]'::jsonb,
  image_url           TEXT,
  unavailable         BOOLEAN NOT NULL DEFAULT FALSE,
  replacement_pending BOOLEAN NOT NULL DEFAULT FALSE,
  replacement_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  swapped_from_name   TEXT
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id              BIGSERIAL PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status     order_status,
  to_status       order_status NOT NULL,
  changed_by      TEXT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_adjustment_requests (
  id              TEXT PRIMARY KEY DEFAULT ('oar_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_menu_id    TEXT,
  item_name       TEXT,
  options         JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pending',
  decision        TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_photos (
  id              TEXT PRIMARY KEY DEFAULT ('dph_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  uploaded_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_signatures (
  id              TEXT PRIMARY KEY DEFAULT ('dsg_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  signature_url   TEXT,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- REVIEWS / FAVOURITES / CHAT
-- =============================================================================

CREATE TABLE IF NOT EXISTS reviews (
  id              TEXT PRIMARY KEY DEFAULT ('rev_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  order_id        TEXT REFERENCES orders(id) ON DELETE SET NULL,
  merchant_id     TEXT REFERENCES merchants(id) ON DELETE CASCADE,
  shop_id         TEXT,
  customer_email  CITEXT,
  customer_name   TEXT,
  merchant_rating INT CHECK (merchant_rating BETWEEN 1 AND 5),
  driver_rating   INT CHECK (driver_rating BETWEEN 1 AND 5),
  product_rating  INT CHECK (product_rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favourites (
  id              TEXT PRIMARY KEY DEFAULT ('fav_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_id     TEXT REFERENCES merchants(id) ON DELETE CASCADE,
  product_id      TEXT REFERENCES products(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (merchant_id IS NOT NULL OR product_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS order_chat_messages (
  id              TEXT PRIMARY KEY DEFAULT ('msg_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_email    CITEXT NOT NULL,
  sender_role     TEXT,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PROMOTIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS promotions (
  id              TEXT PRIMARY KEY DEFAULT ('prm_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  merchant_id     TEXT REFERENCES merchants(id) ON DELETE CASCADE,
  shop_id         TEXT,
  title           TEXT NOT NULL,
  promo_type      promo_type NOT NULL,
  coupon_code     TEXT,
  discount_value  NUMERIC(12,2) DEFAULT 0,
  min_order       NUMERIC(12,2) DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  times_used      INT NOT NULL DEFAULT 0,
  max_uses        INT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_promotions (
  id              TEXT PRIMARY KEY DEFAULT ('aprm_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  title           TEXT NOT NULL,
  promo_type      promo_type NOT NULL,
  coupon_code     TEXT,
  discount_value  NUMERIC(12,2) DEFAULT 0,
  min_order       NUMERIC(12,2) DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  times_used      INT NOT NULL DEFAULT 0,
  max_uses        INT,
  new_users_only  BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id              TEXT PRIMARY KEY DEFAULT ('prd_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  order_id        TEXT REFERENCES orders(id) ON DELETE SET NULL,
  customer_email  CITEXT,
  promotion_id    TEXT,
  admin_promo_id  TEXT,
  amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- WALLETS / FINANCE
-- =============================================================================

CREATE TABLE IF NOT EXISTS wallets (
  id              TEXT PRIMARY KEY DEFAULT ('wal_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  owner_email     CITEXT NOT NULL,
  owner_type      wallet_owner_type NOT NULL,
  owner_user_id   TEXT REFERENCES users(id),
  balance         NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        CHAR(3) NOT NULL DEFAULT 'ZAR',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_email, owner_type)
);

CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT PRIMARY KEY DEFAULT ('txn_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  wallet_id       TEXT REFERENCES wallets(id) ON DELETE SET NULL,
  owner_email     CITEXT NOT NULL,
  owner_type      wallet_owner_type NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  type            TEXT, -- credit | debit | refund | tip | cashback | bonus
  reason          TEXT,
  order_id        TEXT REFERENCES orders(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settlements (
  id              TEXT PRIMARY KEY DEFAULT ('stl_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  partner_email   CITEXT,
  driver_email    CITEXT,
  amount          NUMERIC(14,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  period_start    TIMESTAMPTZ,
  period_end      TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id              TEXT PRIMARY KEY DEFAULT ('wdr_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  owner_email     CITEXT NOT NULL,
  owner_type      wallet_owner_type NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  method          TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS refunds (
  id              TEXT PRIMARY KEY DEFAULT ('rfd_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  order_id        TEXT REFERENCES orders(id) ON DELETE SET NULL,
  customer_email  CITEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'completed',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_points (
  id              TEXT PRIMARY KEY DEFAULT ('loy_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
  owner_email     CITEXT NOT NULL UNIQUE,
  points          INT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referrals (
  id              TEXT PRIMARY KEY DEFAULT ('ref_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  owner_email     CITEXT NOT NULL UNIQUE,
  code            TEXT NOT NULL UNIQUE,
  referred_email  CITEXT,
  reward_amount   NUMERIC(12,2) DEFAULT 10,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gift_cards (
  id              TEXT PRIMARY KEY DEFAULT ('gft_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  code            TEXT NOT NULL UNIQUE,
  balance         NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency        CHAR(3) NOT NULL DEFAULT 'ZAR',
  purchaser_email CITEXT,
  recipient_email CITEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY DEFAULT ('ntf_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  recipient_email CITEXT NOT NULL,
  recipient_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT,
  type            TEXT,
  category        notification_category NOT NULL DEFAULT 'system',
  channel         notification_channel NOT NULL DEFAULT 'in_app',
  link            TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  push_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  in_app_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  categories      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id              BIGSERIAL PRIMARY KEY,
  notification_id TEXT REFERENCES notifications(id) ON DELETE CASCADE,
  channel         notification_channel NOT NULL,
  status          TEXT NOT NULL, -- queued | sent | failed
  provider_response JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- DRIVER
-- =============================================================================

CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email           CITEXT NOT NULL UNIQUE,
  is_online       BOOLEAN NOT NULL DEFAULT FALSE,
  vehicle_type    TEXT,
  license_number  TEXT,
  rating          NUMERIC(3,2) DEFAULT 5.00,
  acceptance_rate NUMERIC(5,2) DEFAULT 100,
  current_lat     DOUBLE PRECISION,
  current_lng     DOUBLE PRECISION,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_incidents (
  id              TEXT PRIMARY KEY DEFAULT ('inc_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  driver_email    CITEXT NOT NULL,
  driver_name     TEXT,
  order_id        TEXT REFERENCES orders(id) ON DELETE SET NULL,
  type            TEXT NOT NULL, -- SOS | accident | harassment | other
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_job_rejections (
  id              BIGSERIAL PRIMARY KEY,
  driver_email    CITEXT NOT NULL,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SUPPORT / ADMIN
-- =============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id              TEXT PRIMARY KEY DEFAULT ('tkt_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  user_email      CITEXT NOT NULL,
  order_id        TEXT REFERENCES orders(id) ON DELETE SET NULL,
  subject         TEXT NOT NULL,
  body            TEXT,
  status          support_ticket_status NOT NULL DEFAULT 'open',
  assigned_to     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disputes (
  id              TEXT PRIMARY KEY DEFAULT ('dsp_' || substr(encode(gen_random_bytes(8), 'hex'), 1, 16)),
  order_id        TEXT REFERENCES orders(id) ON DELETE SET NULL,
  raised_by       CITEXT NOT NULL,
  reason          TEXT,
  status          dispute_status NOT NULL DEFAULT 'open',
  resolution      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  actor_email     CITEXT,
  action          TEXT NOT NULL,
  entity_type     TEXT,
  entity_id       TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_meta (
  key             TEXT PRIMARY KEY,
  value           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_merchants_owner ON merchants(owner_email);
CREATE INDEX IF NOT EXISTS idx_merchants_category ON merchants(category_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(approval_status);
CREATE INDEX IF NOT EXISTS idx_branches_merchant ON merchant_branches(merchant_id);
CREATE INDEX IF NOT EXISTS idx_staff_merchant ON merchant_staff(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_products_branch ON products(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_email, is_read);
CREATE INDEX IF NOT EXISTS idx_transactions_owner ON transactions(owner_email, owner_type);
CREATE INDEX IF NOT EXISTS idx_wallets_owner ON wallets(owner_email, owner_type);
CREATE INDEX IF NOT EXISTS idx_chat_order ON order_chat_messages(order_id, created_at);

-- =============================================================================
-- SEED: LOOKUPS + DEMO USERS
-- Passwords use pgcrypto crypt() — bcrypt. Demo passwords match the app:
--   customer@demo.com / demo
--   *@dashzw.com partners / partner123
--   driver*@dashzw.com / driver123
--   admin@dashzw.com / admin123
-- =============================================================================

INSERT INTO roles (id, label) VALUES
  ('customer', 'Customer'),
  ('driver', 'Driver'),
  ('merchant_owner', 'Merchant Owner'),
  ('merchant_manager', 'Merchant Manager'),
  ('merchant_cashier', 'Merchant Cashier'),
  ('merchant_kitchen', 'Merchant Kitchen Staff'),
  ('merchant_dispatcher', 'Merchant Dispatcher'),
  ('support', 'Support'),
  ('finance', 'Finance'),
  ('admin', 'Admin'),
  ('super_admin', 'Super Admin'),
  ('guest', 'Guest'),
  ('partner', 'Partner (legacy)')
ON CONFLICT (id) DO NOTHING;

INSERT INTO permissions (id, label) VALUES
  ('browse.merchants', 'Browse merchants'),
  ('order.place', 'Place order'),
  ('order.view_own', 'View own orders'),
  ('wallet.manage', 'Manage wallet'),
  ('profile.manage', 'Manage profile'),
  ('merchant.manage', 'Manage merchant'),
  ('merchant.orders', 'Merchant orders'),
  ('merchant.catalog', 'Merchant catalog'),
  ('merchant.staff', 'Merchant staff'),
  ('driver.jobs', 'Driver jobs'),
  ('support.tickets', 'Support tickets'),
  ('finance.settle', 'Finance settle'),
  ('admin.all', 'Admin all')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('guest', 'browse.merchants'),
  ('customer', 'browse.merchants'),
  ('customer', 'order.place'),
  ('customer', 'order.view_own'),
  ('customer', 'wallet.manage'),
  ('customer', 'profile.manage'),
  ('driver', 'driver.jobs'),
  ('driver', 'profile.manage'),
  ('merchant_owner', 'merchant.manage'),
  ('merchant_owner', 'merchant.orders'),
  ('merchant_owner', 'merchant.catalog'),
  ('merchant_owner', 'merchant.staff'),
  ('merchant_manager', 'merchant.orders'),
  ('merchant_manager', 'merchant.catalog'),
  ('merchant_manager', 'merchant.staff'),
  ('merchant_cashier', 'merchant.orders'),
  ('merchant_kitchen', 'merchant.orders'),
  ('merchant_dispatcher', 'merchant.orders'),
  ('support', 'support.tickets'),
  ('finance', 'finance.settle'),
  ('admin', 'admin.all'),
  ('super_admin', 'admin.all'),
  ('partner', 'merchant.manage'),
  ('partner', 'merchant.orders'),
  ('partner', 'merchant.catalog'),
  ('partner', 'merchant.staff')
ON CONFLICT DO NOTHING;

INSERT INTO merchant_categories (id, label, icon, sort_order) VALUES
  ('restaurant', 'Restaurants', '🍽️', 1),
  ('fast_food', 'Fast Food', '🍔', 2),
  ('grocery', 'Grocery', '🛒', 3),
  ('pharmacy', 'Pharmacy', '💊', 4),
  ('convenience', 'Convenience', '🏪', 5),
  ('bakery', 'Bakery', '🥐', 6),
  ('drinks', 'Drinks', '🥤', 7),
  ('desserts', 'Desserts', '🍰', 8),
  ('flowers', 'Flower Shops', '💐', 9),
  ('hardware', 'Hardware', '🔧', 10),
  ('electronics', 'Electronics', '📱', 11),
  ('other', 'Other', '📦', 99)
ON CONFLICT (id) DO NOTHING;

INSERT INTO countries (code, name) VALUES
  ('ZW', 'Zimbabwe'),
  ('ZA', 'South Africa')
ON CONFLICT DO NOTHING;

INSERT INTO currencies (code, name, symbol) VALUES
  ('USD', 'US Dollar', '$'),
  ('ZWG', 'Zimbabwe Gold', 'ZiG'),
  ('ZAR', 'South African Rand', 'R')
ON CONFLICT DO NOTHING;

INSERT INTO languages (code, name) VALUES
  ('en', 'English'),
  ('sn', 'Shona'),
  ('nd', 'Ndebele')
ON CONFLICT DO NOTHING;

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('guest_browse', TRUE, 'Allow guest browsing'),
  ('multi_merchant_cart', FALSE, 'Multi-merchant cart'),
  ('scheduled_delivery', FALSE, 'Scheduled delivery'),
  ('biometric_login', FALSE, 'Biometric login')
ON CONFLICT DO NOTHING;

INSERT INTO platform_config (key, value, description) VALUES
  ('commission_rate', '{"percent": 5}'::jsonb, 'Platform commission %'),
  ('base_delivery_fee', '{"amount": 2.50, "currency": "ZAR"}'::jsonb, 'Base delivery fee'),
  ('tax_rate', '{"percent": 0}'::jsonb, 'Tax rate'),
  ('maps_provider', '{"provider": "leaflet", "status": "placeholder"}'::jsonb, 'Maps'),
  ('storage_provider', '{"provider": "local", "status": "placeholder"}'::jsonb, 'Object storage'),
  ('redis', '{"enabled": false}'::jsonb, 'Redis cache')
ON CONFLICT DO NOTHING;

INSERT INTO surge_config (id, enabled) VALUES ('default', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO payment_providers (id, name, is_enabled) VALUES
  ('ecocash', 'EcoCash', FALSE),
  ('onemoney', 'OneMoney', FALSE),
  ('innbucks', 'InnBucks', FALSE),
  ('card', 'Card gateway', FALSE)
ON CONFLICT DO NOTHING;

-- Demo users (password_hash = bcrypt via pgcrypto)
INSERT INTO users (id, email, password_hash, full_name, role, staff_role, email_verified) VALUES
  ('usr_customer_demo', 'customer@demo.com', crypt('demo', gen_salt('bf')), 'Alex Customer', 'customer', NULL, TRUE),
  ('usr_mamas', 'mamas@dashzw.com', crypt('partner123', gen_salt('bf')), 'Mama''s Kitchen', 'partner', 'owner', TRUE),
  ('usr_zimburger', 'zimburger@dashzw.com', crypt('partner123', gen_salt('bf')), 'Zim Burger Co', 'partner', 'owner', TRUE),
  ('usr_sunrise', 'sunrise@dashzw.com', crypt('partner123', gen_salt('bf')), 'Sunrise Bakery', 'partner', 'owner', TRUE),
  ('usr_chillsip', 'chillsip@dashzw.com', crypt('partner123', gen_salt('bf')), 'Chill & Sip', 'partner', 'owner', TRUE),
  ('usr_sweettooth', 'sweettooth@dashzw.com', crypt('partner123', gen_salt('bf')), 'Sweet Tooth', 'partner', 'owner', TRUE),
  ('usr_freshmart', 'freshmart@dashzw.com', crypt('partner123', gen_salt('bf')), 'FreshMart', 'partner', 'owner', TRUE),
  ('usr_careplus', 'careplus@dashzw.com', crypt('partner123', gen_salt('bf')), 'CarePlus Pharmacy', 'partner', 'owner', TRUE),
  ('usr_quickstop', 'quickstop@dashzw.com', crypt('partner123', gen_salt('bf')), 'QuickStop Convenience', 'partner', 'owner', TRUE),
  ('usr_driver1', 'driver1@dashzw.com', crypt('driver123', gen_salt('bf')), 'Tendai Moyo', 'driver', NULL, TRUE),
  ('usr_driver2', 'driver2@dashzw.com', crypt('driver123', gen_salt('bf')), 'Chido Ncube', 'driver', NULL, TRUE),
  ('usr_driver3', 'driver3@dashzw.com', crypt('driver123', gen_salt('bf')), 'Farai Dube', 'driver', NULL, TRUE),
  ('usr_admin', 'admin@dashzw.com', crypt('admin123', gen_salt('bf')), 'DashZW Admin', 'admin', NULL, TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_profiles (user_id, city, locale, currency)
SELECT id, 'Johannesburg', 'en', 'ZAR' FROM users
ON CONFLICT DO NOTHING;

INSERT INTO driver_profiles (user_id, email, is_online)
SELECT id, email, FALSE FROM users WHERE role = 'driver'
ON CONFLICT DO NOTHING;

INSERT INTO wallets (owner_email, owner_type, owner_user_id, balance)
SELECT email, 'customer', id, 0 FROM users WHERE role = 'customer'
ON CONFLICT DO NOTHING;

INSERT INTO wallets (owner_email, owner_type, owner_user_id, balance)
SELECT email, 'driver', id, 0 FROM users WHERE role = 'driver'
ON CONFLICT DO NOTHING;

INSERT INTO wallets (owner_email, owner_type, owner_user_id, balance)
SELECT email, 'partner', id, 0 FROM users WHERE role IN ('partner', 'merchant_owner')
ON CONFLICT DO NOTHING;

INSERT INTO wallets (owner_email, owner_type, balance)
VALUES ('platform@dashzw.com', 'platform', 0)
ON CONFLICT DO NOTHING;

INSERT INTO loyalty_points (owner_email, user_id, points)
SELECT email, id, 0 FROM users WHERE role = 'customer'
ON CONFLICT DO NOTHING;

INSERT INTO app_meta (key, value) VALUES
  ('schema_version', 'dashzw_pg_v1'),
  ('seeded', 'lookups_and_users')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- =============================================================================
-- DONE
-- Verify:
--   \dt
--   SELECT email, role FROM users;
--   SELECT * FROM merchant_categories;
-- =============================================================================

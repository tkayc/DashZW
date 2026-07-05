# Connect DashZW to PostgreSQL

## After the schema is created

You already ran `000` and `001`. Do this next.

### Step 1 — Seed merchants (required for Admin Merchants page)

1. In pgAdmin, connect to database **dashzw**
2. Open Query Tool
3. Open and run the full file: `backend/sql/002_seed_catalog.sql`
4. You should see counts like merchants=8, products=14, users=13

### Step 1b — USD prices, pizza variants, demo driver job (recommended)

1. In the same Query Tool on **dashzw**
2. Run: `backend/sql/003_usd_variants_driver_job.sql`
3. This sets USD-scale prices, adds a sample pizza with sizes/add-ons, and one **ready_for_pickup** order for the driver app

### Step 1c — Location & maps architecture (required for addresses / live tracking)

1. In the same Query Tool on **dashzw**
2. Run: `backend/sql/004_location_architecture.sql`
3. This extends `user_addresses`, adds driver GPS history, delivery routes, order tracking events, and seeds a demo Auckland Park address for `customer@demo.com`

### Step 2 — Env file

`backend/.env` must contain your real password:

```env
PORT=3001
API_VERSION=v1
JWT_SECRET=change-me-to-a-long-random-string
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/dashzw
```

### Step 3 — Restart API

```bash
npm run dev:api
```

Terminal should show: `PostgreSQL: connected (13 users)`

### Step 4 — Admin app

1. Open http://localhost:5176
2. Login: `admin@dashzw.com` / `admin123`
3. Open **Merchants** — you should see 8 merchants
4. Open **Users**, **Customers**, **Drivers**, **Orders**, etc.

---

## What uses Postgres when DATABASE_URL is set

| Data | Source |
|------|--------|
| Users / login | `users` table |
| Merchants (Shop) | `merchants` |
| Products | `products` |
| Branches / staff | `merchant_branches`, `merchant_staff` |
| Orders | `orders` + `order_items` |
| Wallets / transactions | `wallets`, `transactions` |
| Notifications, promos, incidents | matching tables |
| Saved addresses | `user_addresses` via `/api/location/addresses` |
| Driver GPS history | `driver_location_history` |
| Delivery routes / tracking | `delivery_routes`, `order_tracking_events` |

If `DATABASE_URL` is missing, the API falls back to JSON files in `backend/data/`.

---

## Customer app — one search bar

Header has a single **Search merchants & products** bar. Delivery address is set inside the Delivery/Pickup popup (not a second search field).

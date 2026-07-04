# DashZW — Final Project Report

**Date:** 2026-07-04  
**Version:** monorepo v1.0 (merchant-based multi-app platform)  
**Data layer:** JSON file store (mock) — no PostgreSQL yet

---

## 1. Architecture

```
DashZW/
├── backend/                 # Express API :3001 (JWT, entities, domain, SSE)
├── frontends/
│   ├── customer/            # :5173 — browse, order, track, wallet
│   ├── partner/             # :5174 — merchant portal
│   ├── driver/              # :5175 — driver portal
│   └── admin/               # :5176 — enterprise admin
├── docker-compose.yml       # API container + postgres/redis placeholders
├── Dockerfile
├── .env.example
└── PROJECT_REPORT.md
```

All apps share one API. Domain models live under `backend/src/domain` and are mirrored in each frontend’s `src/domain`.

**Dev:** `npm run dev`  
**Build:** `npm run build`  
**Health:** `GET /api/health` and `GET /api/v1/health`

---

## 2. Customer app

| Area | Status |
|------|--------|
| Auth (email/phone, OTP UI, forgot/reset, remember me, guest, social/bio placeholders) | Implemented (mock) |
| Roles & permission guards | Implemented |
| Home rails (nearby, featured, popular, recommended, recent, reorder, deals, etc.) | Implemented |
| Search + filters/sort | Implemented |
| Product pages (variants, add-ons, images, stock, prep, reviews, favourite, share, related, nutrition/allergens placeholders) | Implemented |
| Cart (coupons, voucher, wallet, tip, instructions, notes, qty, save cart, multi-merchant placeholder) | Implemented |
| Checkout (addresses, pickup/delivery, payment, voucher, wallet, tip, scheduled placeholder, ETA, review order, confirmation) | Implemented |
| Order tracking (timeline, map, merchant status, driver info, call/chat, ETA, OTP, photo placeholder) | Implemented |
| Order history (current/past/cancelled/refunded, receipt, invoice placeholder, reorder, rate, support) | Implemented |
| Profile pages (addresses, payments, wallet, rewards, notifications, privacy, security, about, help, delete account) | Implemented |
| Notifications centre | Implemented |
| Wallet / loyalty / gift cards | Implemented (placeholders where noted) |
| Dark mode | Implemented |
| Lazy-loaded routes | Implemented |

---

## 3. Driver app

| Area | Status |
|------|--------|
| Dashboard (online/offline, availability, today/weekly earnings, current orders, heat map placeholder, performance, ratings) | Implemented |
| Jobs (accept / reject) | Implemented |
| Active workflow (pickup/delivery confirmation, OTP, navigation/photo/signature placeholders) | Implemented |
| SOS + incident reporting | Implemented |
| Wallet (balance, txs, withdraw placeholder, bonuses, incentives, tips, settlement, analytics chart) | Implemented |

---

## 4. Merchant (partner) app

| Area | Status |
|------|--------|
| Dashboard (pending orders, revenue, quick links) | Implemented |
| Orders, products, promotions, earnings | Existing + retained |
| Inventory (categories, products, variants, modifiers, stock, low/out, SKU, barcode/bulk placeholders) | Implemented |
| Analytics (sales, revenue, orders, top products, customers, peak hours, exports/settlement placeholders) | Implemented |
| Staff, branches, reviews, customers, notifications | Implemented |
| Business profile | Existing shop profile |

---

## 5. Admin app

| Area | Status |
|------|--------|
| Enterprise nav + dashboard | Implemented |
| Customers, drivers, merchants, orders | Implemented (list views) |
| Support, refunds, disputes, reports, analytics | Implemented (mock/sections) |
| Commissions, settlement, coupons | Implemented (links/sections) |
| Notifications, audit logs, monitoring | Implemented (placeholders) |
| Role management | Implemented (role catalogue) |
| Platform settings (countries, currencies, languages, taxes, commissions, fees, surge, flags, payments, maps, storage) | Implemented (UI placeholders) |

---

## 6. Backend & production readiness

| Item | Status |
|------|--------|
| JSON mock store | Active when `DATABASE_URL` unset (plaintext passwords — dev only) |
| PostgreSQL auth | Active when `DATABASE_URL` set (`crypt()` passwords) |
| JWT auth | Active; **requires `JWT_SECRET` in production** (no silent fallback) |
| Entity authorization | **Enforced** via `entityPolicy.js` (role + ownership per collection) |
| Raw collection routes | **Removed** (`/:collection/raw` deleted) |
| Customer wallet | **View-only**; mutations only via server checkout / system refunds |
| Checkout wallet debit | Server-side in `orderEngine.placeOrder` (never trusts client amount) |
| SSE realtime | Active |
| Health checks | `/api/health` includes `postgres` status |
| API versioning | `/api` + `/api/v1` mounts |
| Request logging | `LOG_REQUESTS=1` |
| Security headers | Basic (`nosniff`, `SAMEORIGIN`) |
| Git hygiene | Root `.gitignore` excludes `node_modules/`, `dist/`, `.env` |
| Auth verification script | `backend/scripts/verify-entity-auth.mjs` |
| Docker / compose | Placeholders |
| Redis | Placeholder only |
| Env configuration | `backend/.env.example` |
| Error boundaries | Frontends |
| Caching | Placeholder comments |
| Monitoring | Placeholder sections |

### Entity auth verification

```bash
# API must be running
node backend/scripts/verify-entity-auth.mjs
```

Confirms: customer cannot write Wallet / invoke debitWallet; Settlement not listed; partner only sees own Shop; `/raw` is 404.

### Remaining known gaps

- Orders, merchants, products, wallets still primarily JSON-backed (Postgres schema exists; only auth users wired to PG so far)
- Domain `invoke` still exposes many finance methods to partner/admin without fine-grained argument checks
- No rate limiting / CSRF / refresh-token rotation
- Referral credits still write customer wallets via internal `creditWallet` (not customer-callable)
- Driver withdraw remains available to partner/admin flows (by design)

---

## 7. Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Customer | `customer@demo.com` | `demo` |
| Partner | `*@dashzw.com` (seeded) | `partner123` |
| Driver | `driver1@dashzw.com` | `driver123` |
| Admin | `admin@dashzw.com` | `admin123` |

Reseed: delete `backend/data/*.json` (or `_meta.json`) and restart API.

---

## 8. Explicit non-goals (current phase)

- Full entity layer on PostgreSQL (schema ready; runtime still mostly JSON)  
- No live SMS/email/OAuth/WebAuthn providers  
- No real payment rails or customer wallet top-up  
- No production maps/navigation SDK  
- No multi-merchant cart (placeholder only)

---

## 9. Recommended next phase

1. Migrate Order / Shop / Wallet / Transaction repositories to PostgreSQL  
2. Tighten domain `invoke` argument authorization (partner may only top up known drivers, etc.)  
3. Real OTP, OAuth, email verification  
4. Payment provider integration (EcoCash / cards) — not customer wallet top-up  
5. Redis for sessions, rate limits, cache  
6. Object storage for delivery photos & documents  
7. Observability (structured logs, metrics, error tracking)  
8. CI/CD + hardened Docker images for all four frontends  

---

## 10. Maintainability notes

- Domain logic is centralized (`orderStates`, `roles`, `permissions`, merchant architecture).  
- Frontends are self-contained (no shared package) to keep deploys independent.  
- Placeholders use consistent “Coming soon” / toast patterns and `TODO(backend|postgresql|…)` comments.  
- Customer routes are lazy-loaded; ErrorBoundary wraps each app.  
- Cart supports save/restore via `localStorage`.  

This report reflects the monorepo state after the product, cart, checkout, tracking, profile, driver, merchant, admin, and production-readiness expansion.

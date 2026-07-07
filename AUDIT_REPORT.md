# DashZW End-to-End Audit Report

Full-stack audit of the backend + 4 frontends (customer, partner, driver, admin).
Scope: fix non-working functionality, crashes, and correctness bugs **without**
changing UI, architecture, or business logic. No new features added.

---

## 1. Fixes applied (this pass)

### Critical crashes / broken pages

| # | Area | File | Problem | Fix |
|---|------|------|---------|-----|
| 1 | Partner | `partner/pages/PartnerDriverTopUp.jsx` | `useState` declared **after** an early `return` (Rules-of-Hooks violation → crash on auth change) | Moved all hooks above the guard |
| 2 | Partner | `partner/pages/PartnerDriverTopUp.jsx` | `topUpDriver()` returns a summary **object**; code did `balance.toFixed()` → crash after top-up | Re-read scalar via `getBalance()`; wrapped in try/catch/finally with error toast |
| 3 | Admin | `admin/api/client.js` | `DriverIncident` entity missing → `/support` page threw `Cannot read 'list' of undefined` | Registered `DriverIncident` entity client |
| 4 | Admin | `admin/pages/AdminSection.jsx` | `notifyShopApproved(shop)` called with wrong args → broken approval notification | Now `notifyShopApproved(shop.owner_email, shop.name)` |
| 5 | Customer | `customer/pages/ProductDetail.jsx` | Image `src` received an object (`{id,url}`) → broken image; missing "not found" state → infinite skeleton | Use `images[imageIdx]?.url`; split loading vs not-found with empty state |
| 6 | Customer | `customer/pages/OrderConfirmation.jsx` | Infinite spinner when order missing/failed | Split loading vs not-found; added recovery UI |

### Backend money / correctness

| # | File | Problem | Fix |
|---|------|---------|-----|
| 7 | `financial/payoutService.js` | Withdrawal record dropped — `getCollection()` re-read disk **before** save, losing the pushed record | Push into a single reference, then save it |
| 8 | `orders/orderEngine.js` | Auto-cancel refunded only `order.total` (missed `wallet_applied`); no already-cancelled guard; `total?.toFixed` crash risk | Refund `total + wallet_applied`; mark cancelled first (prevents double refund); pass `orderId`; safe number formatting |
| 9 | `authentication/users.js` | Registration accepted any `role` from the body → **privilege escalation to `admin`** | Allowlist self-registrable roles (`customer/partner/driver`); anything else → `customer` |
| 10 | `routes/domain.js` | `super_admin` was blocked (403) from all admin-only APIs (financial dashboard, settlements, reset) | Treat `super_admin` like `admin` |
| 11 | `admin/adminPromotions.js` | Coupon validation read JSON store even in PG mode (coupons never found); `min_order_amount` vs `min_order` field drift; new-user check missed `completed` + case-sensitive email | Made validation PG-aware & async; accept either min-order field; normalize status + email |
| 12 | `db/pgEntities.js` + `db/pg.js` + `index.js` + `sql/001` | Settlement idempotency broken: `settled_at` never persisted in PG (not in update allowlist, column didn't exist) → risk of duplicate platform promo debits on re-settlement | Added `settled_at` to update allowlist + schema; self-applying `ensureSchemaPatches()` runs `ADD COLUMN IF NOT EXISTS` at boot |

### Frontend correctness / navigation

| # | Area | File | Problem | Fix |
|---|------|------|---------|-----|
| 13 | Partner | `partner/pages/PartnerDashboard.jsx` | "Today's Revenue" counted in-progress orders and **excluded** delivered/completed | Count today's delivered/completed only |
| 14 | Driver | `driver/pages/DriverProfilePage.jsx` | Stats used `status === 'delivered'` but deliveries persist as `completed` → always 0 deliveries / $0 | Include `delivered` + `completed` |
| 15 | Admin | `admin/pages/AdminDashboard.jsx` | Platform balance fetched with default `customer` owner type → wrong number | `getBalance(PLATFORM_EMAIL, 'platform')` |
| 16 | Partner | `partner/pages/PartnerEarnings.jsx` | Shop query key `['my-shop']` diverged from `['partner-shop']` used app-wide → stale data | Unified to `['partner-shop']` |
| 17 | Partner+Driver | `*/components/shared/NotificationBell.jsx` | Deep links used cross-app prefixes (`/partner/orders`, `/driver/profile`) that don't exist in each SPA → dead navigation | Added per-app link normalization to real routes |
| 18 | Partner | `partner/pages/PartnerSection.jsx` | Staff list showed blank names (`MerchantStaff` uses `user_email`) | `s.name || s.user_email || s.email` |
| 19 | All 4 apps | `*/components/shared/NotificationBell.jsx` | Invalid HTML: `<button>` nested in `<button>` (delete inside row) | Converted inner control to `role="button"` span |
| 20 | Shared | `shared/location/components/PlatformMap.jsx` | Map config hardcoded `http://localhost:3001`, bypassing Vite dev proxy → CORS/host failures | Use `resolveApiBaseUrl()` |
| 21 | Customer | `customer/pages/Checkout.jsx` | `navigate()` called during render (React warning, Strict-Mode double-fire) | Moved to `useEffect` |
| 22 | Driver | `driver/pages/DriverAvailableJobs.jsx` | `acceptJob` had no `catch` — failed accept (e.g. job already taken) showed no feedback and left stale state | Added catch + error toast + query invalidation |
| 23 | Partner | `partner/pages/PartnerOrders.jsx` | `advance`/`cancel` mutations unhandled → silent failure, stale UI | Wrapped in try/catch with error toast + invalidation |

All edited files pass linting and `node --check` syntax validation.

---

## 2. Remaining critical issues (NOT fixed — need your decision)

These are real risks I intentionally did **not** change because the fix would
alter business logic/architecture, requires infrastructure you must provision,
or carries regression risk that needs live testing.

### Security — require product decisions

1. **Unauthenticated password reset (account takeover).**
   `POST /auth/reset-password` (`authentication/routes.js`, `users.js`) sets a new
   password for any email with **no token, OTP, or auth**. A proper fix needs an
   emailed signed reset token (new infrastructure) — that's a feature, so I left it.
   **This is the single most dangerous issue in the codebase.**

2. **`/domain/invoke` allows drivers/partners to mint wallet money.**
   `CUSTOMER_BLOCKED` only blocks the `customer` role. Drivers/partners can still
   call `finance.creditWallet`, `financial.creditWallet`, `orderEngine.awardPoints`,
   etc. Correct fix = per-role **allowlist** of invokable methods. Left because
   tightening it risks breaking legitimate partner/driver calls without live testing.

3. **`placeOrder` trusts client-supplied pricing.**
   Only `total_before_wallet` is validated; `partner_payout`, `platform_earning`,
   `delivery_fee`, etc. are taken from the client and used at settlement. A customer
   could inflate payout fields. Correct fix = recompute all pricing server-side from
   shop/menu — a meaningful change to the checkout/settlement contract.

4. **IDOR: profile / chat / order-tracking / driver GPS.**
   `GET/PATCH /profile/:email`, `chat/:orderId`, `location/orders/:id/tracking`,
   `location/drivers/:email/location` have no ownership checks — any logged-in user
   can read/modify others' data. Fixes are ownership guards, but they can break
   cross-app flows (e.g. driver viewing customer contact) and need testing per flow.

### Order-state integrity

5. **No server-side status-transition enforcement.**
   `MERCHANT_STATUS_FLOW`/`DRIVER_STATUS_FLOW` in `domain/orderStates.js` are
   documentation only. Any authorized writer can PATCH `status` straight to
   `delivered`/`completed` and trigger settlement. Needs a central
   `transitionOrderStatus()` guard — an architectural addition.

6. **COD float reservation failures are swallowed.**
   In `entities.js`, driver assignment succeeds even if `reserveFloatForOrder`
   throws (error only logged); `canAcceptCodOrder` isn't called before assignment.
   Can leave settlement unable to release float. Fix needs gating the PATCH, which
   changes the assignment contract.

### Financial split-brain (PostgreSQL mode)

7. **Customer wallets bypass the ledger in PG mode.**
   `walletService` updates the `wallets` table for customers but partner/driver/
   platform flows use the JSON ledger. The financial dashboard reads the ledger, so
   customer wallet activity can be invisible there. Unifying them is an architectural
   change to the money layer.

### Dead / unwired features (present in code, never triggered)

8. **Loyalty points** (`awardPoints`) and **referrals** (`applyReferral`) are
   implemented but never called anywhere. Wiring them up is a new feature, so left off.
9. **Minimum-order enforcement** is mentioned in comments but not enforced in
   `placeOrder`.

---

## 3. Lower-severity items observed (not fixed)

- Guest users can add to cart but `/cart` and `/checkout` redirect to login (UX trap).
- Phone OTP login navigates to `/login` instead of creating a session (mock flow).
- Each `useRealtimeQuery` opens its own `EventSource` + 3s polling → connection bloat
  (perf). A shared singleton SSE would reduce load; left to avoid behavior change.
- `cartVoucher` entered on the cart page isn't re-applied at checkout.
- Several admin section aggregates (GMV/commissions) include non-completed orders.
- Orphan pages/routes: `DeliveryInstructions` (no route), `/deals` (no link),
  `/delivery-map` (no nav entry).
- Currency label inconsistencies (`R` vs `$`) in a few driver/admin rows.

Full per-file findings from the four sub-audits are available on request.

---

## 4. Notes for deployment

- The `settled_at` schema patch applies automatically on backend boot when
  PostgreSQL is enabled (`ensureSchemaPatches()`), so no manual migration is needed.
- In JSON-file mode (no `DATABASE_URL`), passwords are stored in plaintext — intended
  for local demo only, per the existing startup warning.

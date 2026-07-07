# DashZW Financial Engine Report

## 1. Architecture Overview

DashZW is implemented as a **ledger-first financial engine**. All money flows through DashZW as intermediary — never directly between customer, merchant, or driver.

```
┌─────────────┐     ┌──────────────────────────────────────┐     ┌─────────────┐
│  Customer   │────▶│         DashZW Financial Core        │────▶│  Merchant   │
│    App      │     │  Ledger → Settlement → Payout        │     │    App      │
└─────────────┘     │         ▲              ▲               │     └─────────────┘
                    │         │              │               │
┌─────────────┐     │    Driver Float   Platform Revenue    │     ┌─────────────┐
│   Driver    │────▶│         Service                        │◀────│    Admin    │
│    App      │     └──────────────────────────────────────┘     │    App      │
└─────────────┘                                                  └─────────────┘
```

### Module location

`backend/src/services/financial/`

| Service | File | Responsibility |
|---------|------|----------------|
| **Ledger Service** | `ledgerService.js` | Immutable double-entry postings, reversals |
| **Wallet Service** | `walletService.js` | Customer/partner legacy wallet API; balances from ledger |
| **Driver Float Service** | `driverFloatService.js` | Float deposit, reserve, COD gating |
| **Settlement Service** | `settlementService.js` | Order completion financial split |
| **Merchant Settlement Service** | `merchantSettlementService.js` | Pending → available → admin payout |
| **Platform Revenue Service** | `platformRevenueService.js` | Platform aggregates |
| **Payout Service** | `payoutService.js` | Driver withdrawals (earnings only) |
| **Transaction Service** | `transactionService.js` | Ledger queries & filters |
| **Accounting Service** | `accountingService.js` | Admin dashboard aggregates |
| **Pricing Service** | `pricingService.js` | Pure pricing + customer receipt builder |
| **Repository** | `repository.js` | JSON + PostgreSQL persistence |

### Backward compatibility

`backend/src/services/payments/finance.js` and `settlements.js` are **thin facades** re-exporting the financial module. All existing `invoke('finance', …)` and `invoke('settlements', …)` calls continue to work.

---

## 2. Files Created

### Backend
- `backend/src/services/financial/constants.js`
- `backend/src/services/financial/repository.js`
- `backend/src/services/financial/ledgerService.js`
- `backend/src/services/financial/walletService.js`
- `backend/src/services/financial/driverFloatService.js`
- `backend/src/services/financial/pricingService.js`
- `backend/src/services/financial/settlementService.js`
- `backend/src/services/financial/merchantSettlementService.js`
- `backend/src/services/financial/platformRevenueService.js`
- `backend/src/services/financial/payoutService.js`
- `backend/src/services/financial/transactionService.js`
- `backend/src/services/financial/accountingService.js`
- `backend/src/services/financial/index.js`
- `backend/sql/005_financial_ledger.sql`

### Frontend
- `frontends/admin/src/api/domain/financial.js`
- `frontends/admin/src/pages/AdminFinancialDashboard.jsx`
- `frontends/driver/src/api/domain/financial.js`
- `frontends/partner/src/api/domain/financial.js`

### Documentation
- `FINANCIAL_ENGINE_REPORT.md` (this file)

---

## 3. Files Modified

| File | Change |
|------|--------|
| `backend/src/services/payments/finance.js` | Facade → financial module |
| `backend/src/services/payments/settlements.js` | Facade → financial module |
| `backend/src/db/localDb.js` | New JSON collections for ledger |
| `backend/src/routes/domain.js` | `financial` module registered |
| `backend/src/routes/entities.js` | Float reserve on driver accept; settlement hook |
| `frontends/customer/src/pages/Checkout.jsx` | Separated receipt lines |
| `frontends/driver/src/pages/DriverAvailableJobs.jsx` | Float check before COD accept |
| `frontends/admin/src/App.jsx` | `/financial` route |
| `frontends/admin/src/pages/AdminLayout.jsx` | Financial nav item |
| API index files (admin, driver, partner) | Export financial domain |

---

## 4. Database Changes

### PostgreSQL (`005_financial_ledger.sql`)
- `ledger_transactions` — immutable double-entry legs
- `financial_audit_logs` — every financial action logged
- `driver_float_accounts` — denormalized float snapshot (optional)
- `float_top_ups` — partner float top-up records
- `merchant_financial_config` — settlement frequency (default weekly)
- `settlement_runs` — admin settlement batch records
- `platform_revenue_snapshots` — point-in-time revenue

### JSON mode (dev/default)
- `LedgerTransaction.json`
- `FinancialAuditLog.json`
- `FloatTopUp.json`
- `SettlementRun.json`
- `MerchantFinancialConfig.json`
- `DriverFloatAccount.json`

**Source of truth:** `LedgerTransaction` entries. Wallet.json is synced for backward compatibility only.

---

## 5. Ledger Design

### Account ID format
```
{owner_type}:{owner_email}:{bucket}
```

Examples:
- `driver:driver@demo.com:float`
- `driver:driver@demo.com:earnings`
- `merchant:mamas@dashzw.com:pending`
- `platform:platform@dashzw.com:revenue`

### Double-entry rules
- Every `postTransaction()` must balance debits = credits
- Negative balances blocked at post time
- Entries are **never edited** — use `reverseTransaction()` for corrections
- `idempotency_key` prevents duplicate settlements, withdrawals, top-ups

### Transaction types
`customer_payment`, `cod_collection`, `online_payment`, `driver_float_topup`, `driver_float_reserve`, `driver_earnings`, `driver_tip`, `merchant_settlement`, `platform_commission`, `withdrawal`, `refund`, `reversal`, etc.

---

## 6. Settlement Workflow

1. **Checkout** — `orderEngine.placeOrder` debits customer wallet via ledger (if used)
2. **Merchant accepts** → prepares → ready
3. **Driver accepts** — float reserved (`customer_subtotal`) for COD
4. **Delivery complete** — `entities.js` PATCH → `settleOrder()`
5. **Distribution ledger txn** — credits merchant pending, platform revenue, driver earnings/tips
6. **COD txn** (if applicable) — records cash collected + liability
7. **Pending → Available** — merchant funds move after delivery
8. **Admin settlement** — pays merchant externally, debits available, credits settled

---

## 7. Driver Float Workflow

### Principles
- Float = **security deposit**, NOT earnings, NOT withdrawable
- Required float for COD = `customer_subtotal` (merchant amount + platform fee)
- Collected COD cash does **not** increase float

### Top-up (merchant partner)
1. Driver brings cash to approved merchant
2. Merchant app → Financial Services → Driver Float Top-up
3. Ledger: credit `driver:float`, credit `merchant:cash_credit`
4. Float available for next COD job

### Accept COD job
1. Check `available_float >= customer_subtotal`
2. Reserve float (debit float, credit float_reserved)
3. On delivery: release reserved float

---

## 8. Merchant Settlement Workflow

| Bucket | Meaning |
|--------|---------|
| `pending` | Credited on order settlement |
| `available` | After delivery completion |
| `settled` | After admin pays out |
| `cash_credit` | Physical cash received from drivers |

Default frequency: **weekly** (configurable: daily, weekly, monthly, manual).

Partner dashboard: `getMerchantFinancialSummary(email)` returns pending, available, history, next settlement date.

---

## 9. Withdrawal Workflow

- **Only** `earnings + tips` are withdrawable
- Float and COD cash **cannot** be withdrawn
- Merchant pays cash to driver at partner shop
- $0.50 fee: $0.30 platform, $0.20 merchant
- Idempotent withdrawal records in `Withdrawal.json`

---

## 10. COD Workflow

```
Customer pays cash → Driver
         ↓
Ledger records:
  • cod_collected (cash on hand)
  • cod_liability (owed to DashZW)
  • merchant pending (partner payout)
  • platform revenue
  • driver earnings + tips
         ↓
Float released (unchanged balance — was only reserved)
         ↓
Driver tops up float at merchant OR remits cash
```

---

## 11. Online Payment Workflow

```
Customer pays (gateway placeholder / wallet)
         ↓
Ledger: distribution on delivery
  • merchant pending
  • platform revenue
  • driver earnings + tips
         ↓
Pending → available after delivery
         ↓
Driver withdraws earnings at merchant
         ↓
Admin settles merchant available balance
```

---

## 12. Fraud Prevention

| Control | Implementation |
|---------|----------------|
| No negative balances | Validated in `postTransaction()` |
| No duplicate settlements | `idempotency_key` + `order.settled_at` |
| No duplicate withdrawals | Idempotency key per withdrawal |
| No duplicate top-ups | Idempotency + audit log |
| Immutable ledger | No update/delete on ledger entries |
| Audit trail | `FinancialAuditLog` on every action |
| Customer wallet protection | `CUSTOMER_BLOCKED` in domain.js |
| Float gating | `canAcceptCodOrder()` before job accept |

---

## 13. Future Payment Gateway Integration

Integration points (not yet connected):

1. **`recordOnlinePaymentAtCheckout()`** in `settlementService.js` — call after PSP confirms payment
2. **Webhook handler** (new route) → credit `platform:escrow`, trigger `placeOrder`
3. **EcoCash / OneMoney / InnBucks** — map `payment_method` to PSP adapter
4. **Customer receipt** — `buildCustomerReceipt()` already separates line items for PSP itemization

Recommended PSP flow:
```
PSP webhook → verify signature → postTransaction(ONLINE_PAYMENT)
           → orderEngine.placeOrder (idempotent on order ref)
```

---

## 14. Scaling Recommendations

1. **PostgreSQL mandatory in production** — run `005_financial_ledger.sql`
2. **Partition `ledger_transactions` by month** — for millions of rows
3. **Materialized balance views** — refresh from ledger nightly; real-time for hot accounts
4. **Event sourcing** — publish ledger events to Kafka for analytics
5. **Read replicas** — dashboard queries on replica, writes on primary
6. **Idempotency store** — Redis TTL keys for high-throughput checkout
7. **Settlement batch jobs** — cron for weekly merchant payouts
8. **Reconciliation service** — compare PSP settlements vs ledger daily

---

## API Reference (domain invoke)

| Module | Method | Access |
|--------|--------|--------|
| `financial` | `getFinancialDashboard` | Admin |
| `financial` | `getDriverFloatSummary` | Driver/Admin |
| `financial` | `canAcceptCodOrder` | Driver |
| `financial` | `topUpDriverFloat` | Partner |
| `financial` | `getMerchantFinancialSummary` | Partner/Admin |
| `financial` | `buildCustomerReceipt` | Public |
| `finance` | *(all legacy methods)* | Unchanged |

Admin UI: **Financial** nav → `/financial`

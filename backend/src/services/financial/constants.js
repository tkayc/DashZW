/**
 * Financial engine constants — account buckets, transaction types, platform identity.
 */

export const PLATFORM_EMAIL = 'platform@dashzw.com';
export const DEFAULT_CURRENCY = 'USD';
export const BLOCK_THRESHOLD = 0;

export const PLATFORM_PERCENT = 0.05;
export const SERVICE_FEE_PER_TIER = 0.15;
export const SERVICE_FEE_TIER_SIZE = 1.50;
export const SERVICE_FEE_THRESHOLD = 1.15;
export const PER_KM_RATE = 0.75;
export const MIN_DELIVERY_FEE = 1.00;
export const HIGH_DEMAND_COUNT = 5;
export const HIGH_DEMAND_MULT = 1.10;

export const WITHDRAWAL_FEE = 0.50;
export const FEE_TO_PLATFORM = 0.30;
export const FEE_TO_PARTNER = 0.20;

export const SETTLEMENT_FREQUENCIES = ['daily', 'weekly', 'monthly', 'manual'];
export const DEFAULT_SETTLEMENT_FREQUENCY = 'weekly';
export const DEFAULT_HOLDING_HOURS = 0;

/** Ledger account buckets */
export const ACCOUNT_BUCKET = {
  CUSTOMER_WALLET: 'wallet',
  DRIVER_FLOAT: 'float',
  DRIVER_FLOAT_RESERVED: 'float_reserved',
  DRIVER_EARNINGS: 'earnings',
  DRIVER_TIPS: 'tips',
  DRIVER_COD_COLLECTED: 'cod_collected',
  DRIVER_COD_LIABILITY: 'cod_liability',
  MERCHANT_PENDING: 'pending',
  MERCHANT_AVAILABLE: 'available',
  MERCHANT_SETTLED: 'settled',
  MERCHANT_CASH_CREDIT: 'cash_credit',
  PLATFORM_REVENUE: 'revenue',
  PLATFORM_PENDING: 'pending_revenue',
  PLATFORM_ESCROW: 'escrow',
  PLATFORM_CLEARING: 'clearing',
};

export const TX_TYPE = {
  CUSTOMER_PAYMENT: 'customer_payment',
  COD_COLLECTION: 'cod_collection',
  ONLINE_PAYMENT: 'online_payment',
  DRIVER_FLOAT_TOPUP: 'driver_float_topup',
  DRIVER_FLOAT_REFUND: 'driver_float_refund',
  DRIVER_FLOAT_RESERVE: 'driver_float_reserve',
  DRIVER_FLOAT_RELEASE: 'driver_float_release',
  DRIVER_EARNINGS: 'driver_earnings',
  DRIVER_TIP: 'driver_tip',
  MERCHANT_SETTLEMENT: 'merchant_settlement',
  MERCHANT_PENDING_CREDIT: 'merchant_pending_credit',
  MERCHANT_AVAILABLE_CREDIT: 'merchant_available_credit',
  PLATFORM_COMMISSION: 'platform_commission',
  PLATFORM_FEE: 'platform_fee',
  DELIVERY_FEE: 'delivery_fee',
  REFUND: 'refund',
  COUPON: 'coupon',
  WALLET_CREDIT: 'wallet_credit',
  WALLET_DEBIT: 'wallet_debit',
  WITHDRAWAL: 'withdrawal',
  ADJUSTMENT: 'adjustment',
  PENALTY: 'penalty',
  BONUS: 'bonus',
  REVERSAL: 'reversal',
  LEGACY_WALLET_SYNC: 'legacy_wallet_sync',
};

export function accountId(ownerType, ownerEmail, bucket) {
  return `${ownerType}:${(ownerEmail || '').toLowerCase()}:${bucket}`;
}

export function platformAccount(bucket) {
  return accountId('platform', PLATFORM_EMAIL, bucket);
}

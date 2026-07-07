/**
 * Transaction Service — query and filter ledger transactions.
 */
import { getCollection } from '../../db/localDb.js';
import { listLedger, listLedgerPg } from './repository.js';
import { isPostgresEnabled } from '../../db/pg.js';

export async function queryTransactions(filters = {}, limit = 200) {
  if (isPostgresEnabled()) {
    return listLedgerPg(filters, limit);
  }
  return listLedger(filters, limit);
}

export function filterTransactions({
  merchantEmail,
  driverEmail,
  customerEmail,
  transactionType,
  paymentMethod,
  dateFrom,
  dateTo,
  limit = 200,
} = {}) {
  let rows = getCollection('LedgerTransaction');

  if (merchantEmail) rows = rows.filter((r) => r.merchant_id === merchantEmail);
  if (driverEmail) rows = rows.filter((r) => r.driver_id === driverEmail);
  if (customerEmail) rows = rows.filter((r) => r.customer_id === customerEmail);
  if (transactionType) rows = rows.filter((r) => r.transaction_type === transactionType);
  if (dateFrom) rows = rows.filter((r) => new Date(r.created_date) >= new Date(dateFrom));
  if (dateTo) rows = rows.filter((r) => new Date(r.created_date) <= new Date(dateTo));

  if (paymentMethod && paymentMethod !== 'all') {
    const orderIds = getCollection('Order')
      .filter((o) => o.payment_method === paymentMethod)
      .map((o) => o.id);
    rows = rows.filter((r) => orderIds.includes(r.order_id));
  }

  return rows
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, limit);
}

export function getTransactionById(transactionId) {
  return getCollection('LedgerTransaction').filter((r) => r.transaction_id === transactionId);
}

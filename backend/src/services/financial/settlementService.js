/**
 * Settlement Service — order financial settlement (COD + online).
 */
import { postTransaction } from './ledgerService.js';
import { accountId, platformAccount, ACCOUNT_BUCKET, TX_TYPE } from './constants.js';
import { releaseFloatForOrder } from './driverFloatService.js';
import { movePendingToAvailable } from './merchantSettlementService.js';
import { applyPlatformPromoSettlement } from '../admin/adminPromotions.js';
import { getDriverFloatSummary } from './driverFloatService.js';
import { insertAuditLog } from './repository.js';

function orderAccounts(order) {
  const driver = order.driver_email;
  const merchant = order.partner_email;
  return {
    driverEarnings: accountId('driver', driver, ACCOUNT_BUCKET.DRIVER_EARNINGS),
    driverTips: accountId('driver', driver, ACCOUNT_BUCKET.DRIVER_TIPS),
    driverCodCollected: accountId('driver', driver, ACCOUNT_BUCKET.DRIVER_COD_COLLECTED),
    driverCodLiability: accountId('driver', driver, ACCOUNT_BUCKET.DRIVER_COD_LIABILITY),
    merchantPending: accountId('merchant', merchant, ACCOUNT_BUCKET.MERCHANT_PENDING),
    platformRevenue: platformAccount(ACCOUNT_BUCKET.PLATFORM_REVENUE),
    platformClearing: platformAccount(ACCOUNT_BUCKET.PLATFORM_CLEARING),
  };
}

export async function settleOrder(order) {
  if (order.settled_at) {
    return { alreadySettled: true };
  }

  const {
    id, driver_email, partner_email, payment_method,
    partner_payout, platform_earning, driver_earning,
    customer_subtotal, delivery_fee, driver_tip,
    is_pickup,
  } = order;

  const ref = `Order #${id?.slice(-6)}`;
  const isCash = payment_method === 'cash_on_delivery';
  const earning = parseFloat((driver_earning || 0).toFixed(2));
  const tip = parseFloat((driver_tip || 0).toFixed(2));
  const partnerAmt = parseFloat((partner_payout || 0).toFixed(2));
  const platformAmt = parseFloat((platform_earning || 0).toFixed(2));
  const cs = parseFloat((customer_subtotal || 0).toFixed(2));
  const df = parseFloat((delivery_fee || 0).toFixed(2));

  const ctx = {
    order_id: id,
    customer_id: order.customer_email,
    driver_id: driver_email,
    merchant_id: partner_email,
    reference_number: ref,
  };

  const distLegs = [
    { accountId: orderAccounts(order).merchantPending, side: 'credit', amount: partnerAmt },
    { accountId: orderAccounts(order).platformRevenue, side: 'credit', amount: platformAmt },
  ];
  let distDebit = partnerAmt + platformAmt;

  if (!is_pickup && driver_email && earning > 0) {
    distLegs.push({ accountId: orderAccounts(order).driverEarnings, side: 'credit', amount: earning });
    distDebit += earning;
  }
  if (!is_pickup && driver_email && tip > 0) {
    distLegs.push({ accountId: orderAccounts(order).driverTips, side: 'credit', amount: tip });
    distDebit += tip;
  }
  distLegs.push({ accountId: orderAccounts(order).platformClearing, side: 'debit', amount: distDebit });

  await postTransaction({
    transactionType: isCash ? TX_TYPE.COD_COLLECTION : TX_TYPE.ONLINE_PAYMENT,
    legs: distLegs,
    context: ctx,
    description: `Order distribution ${ref}`,
    idempotencyKey: `settle_dist_${id}`,
  });

  if (isCash && !is_pickup && driver_email) {
    const cashCollected = parseFloat((cs + df + tip).toFixed(2));
    const accts = orderAccounts(order);
    await postTransaction({
      transactionType: TX_TYPE.COD_COLLECTION,
      legs: [
        { accountId: accts.driverCodCollected, side: 'credit', amount: cashCollected },
        { accountId: accts.driverCodLiability, side: 'debit', amount: cs },
        { accountId: accts.platformClearing, side: 'debit', amount: df + tip },
      ],
      context: ctx,
      description: `COD cash & liability ${ref}`,
      idempotencyKey: `settle_cod_${id}`,
    });
    await releaseFloatForOrder(driver_email, order);
  }

  if (partner_email) {
    await movePendingToAvailable(partner_email, partnerAmt, id);
  }

  await applyPlatformPromoSettlement(order);

  insertAuditLog({
    action: 'order_settled',
    actor_email: 'system',
    target_type: 'order',
    target_id: id,
    payload: { payment_method, partnerAmt, platformAmt },
  });

  return {
    settled: true,
    driver_summary: driver_email ? getDriverFloatSummary(driver_email) : null,
  };
}

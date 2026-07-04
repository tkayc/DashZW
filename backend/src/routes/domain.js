import { Router } from 'express';
import { authMiddleware } from '../services/authentication/middleware.js';
import * as finance from '../services/payments/finance.js';
import * as notifications from '../services/notifications/notifications.js';
import * as orderEngine from '../services/orders/orderEngine.js';
import * as adminPromotions from '../services/admin/adminPromotions.js';
import * as settlements from '../services/payments/settlements.js';
import * as surgePricing from '../services/admin/surgePricing.js';
import * as seedData from '../services/merchant/seedData.js';

const modules = {
  finance,
  notifications,
  orderEngine,
  adminPromotions,
  settlements,
  surgePricing,
  seedData,
};

const ADMIN_ONLY = new Set([
  'seedData.resetTransactionalData',
  'seedData.resetOrderData',
  'seedData.factoryReset',
  'settlements.settlePartnerWallet',
  'settlements.getCodReceivables',
  'settlements.getSettlements',
  'settlements.getAllWithdrawals',
  'adminPromotions.createAdminPromotion',
  'adminPromotions.updateAdminPromotion',
  'adminPromotions.deleteAdminPromotion',
  'surgePricing.setSurgeConfig',
]);

/** Direct wallet mutations — never callable by customer role */
const CUSTOMER_BLOCKED = new Set([
  'finance.creditWallet',
  'finance.debitWallet',
  'finance.topUpDriver',
  'finance.refundToCustomerWallet',
  'settlements.driverWithdraw',
  'settlements.driverTopUp',
  'settlements.settlePartnerWallet',
]);

const router = Router();

function isCustomer(user) {
  return user?.role === 'customer';
}

router.post('/invoke', authMiddleware, async (req, res) => {
  try {
    const { module, method, args = [] } = req.body;
    const key = `${module}.${method}`;
    const mod = modules[module];
    if (!mod || typeof mod[method] !== 'function') {
      return res.status(400).json({ message: `Unknown ${key}` });
    }
    if (ADMIN_ONLY.has(key) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (isCustomer(req.user) && CUSTOMER_BLOCKED.has(key)) {
      return res.status(403).json({
        message: 'Customers cannot modify wallet balances directly. Balance is applied automatically at checkout.',
      });
    }

    // getBalance: customers may only query their own balance
    if (key === 'finance.getBalance' && isCustomer(req.user)) {
      const email = args[0];
      if (email && email.toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      args[0] = req.user.email;
      args[1] = args[1] || 'customer';
    }

    // placeOrder / adjustment refund — inject authenticated user as first arg
    if (key === 'orderEngine.placeOrder') {
      const result = await orderEngine.placeOrder(req.user, args[0] || {});
      return res.json({ result });
    }
    if (key === 'orderEngine.creditCustomerRefundForAdjustment') {
      const result = orderEngine.creditCustomerRefundForAdjustment(
        req.user,
        args[0],
        args[1],
        args[2]
      );
      return res.json({ result });
    }
    if (key === 'orderEngine.cancelOwnOrder') {
      const result = await orderEngine.cancelOwnOrder(req.user, args[0]);
      return res.json({ result });
    }

    // Partner-only driver top-up / withdraw
    if (key === 'finance.topUpDriver' || key === 'settlements.driverWithdraw') {
      if (!['partner', 'admin', 'merchant_owner'].includes(req.user.role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }

    const result = await mod[method](...args);
    res.json({ result });
  } catch (e) {
    res.status(400).json({ message: e.message || 'Invoke failed' });
  }
});

router.post('/invoke-public', async (req, res) => {
  try {
    const { module, method, args = [] } = req.body;
    const publicAllow = new Set([
      'surgePricing.calcSurgeMultiplier',
      'adminPromotions.validateAdminCoupon',
      'adminPromotions.calcAdminPromoDiscount',
    ]);
    const key = `${module}.${method}`;
    if (!publicAllow.has(key)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const mod = modules[module];
    const result = await mod[method](...args);
    res.json({ result });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

export default router;

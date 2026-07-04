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

const router = Router();

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

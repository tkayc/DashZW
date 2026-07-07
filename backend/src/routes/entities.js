import { Router } from 'express';
import { optionalAuth } from '../services/authentication/middleware.js';
import { localDb } from '../db/localDb.js';
import { getPolicy } from './entityPolicy.js';
import { notifyOrderStatusChanged } from '../services/notifications/notifications.js';
import { ORDER_STATUS, normalizeOrderStatus } from '../domain/orderStates.js';
import { settleOrder } from '../services/financial/settlementService.js';
import { reserveFloatForOrder } from '../services/financial/driverFloatService.js';

const COLLECTIONS = Object.keys(localDb.entities);
const router = Router();

// Optional JWT — publicRead collections (Shop, MenuItem, etc.) work for guests
router.use(optionalAuth);

function requireAuth(req, res) {
  if (!req.user) {
    res.status(401).json({ message: 'Not authenticated' });
    return false;
  }
  return true;
}

function normalizeRole(role) {
  if (role === 'merchant_owner') return 'partner';
  return role;
}

function userEmail(user) {
  return (user?.email || '').toLowerCase();
}

async function resolveOwnerEmail(collection, record) {
  if (!record) return null;
  const policy = getPolicy(collection);
  if (policy.resolveOwner === 'shop') {
    const shopId = record.shop_id || record.merchant_id;
    if (!shopId) return record.owner_email?.toLowerCase() || null;
    const shops = await localDb.entities.Shop.filter({ id: shopId }, '-created_date', 1);
    return shops[0]?.owner_email?.toLowerCase() || null;
  }
  if (policy.ownerField) {
    return (record[policy.ownerField] || '').toLowerCase() || null;
  }
  return null;
}

function isAdmin(user) {
  return normalizeRole(user?.role) === 'admin' || user?.role === 'super_admin';
}

function isPartner(user) {
  const r = normalizeRole(user?.role);
  return r === 'partner';
}

function isDriver(user) {
  return normalizeRole(user?.role) === 'driver';
}

function roleAllowed(user, policy) {
  if (isAdmin(user)) return true;
  const role = normalizeRole(user?.role);
  if ((policy.roles || []).includes(role)) return true;
  if ((policy.roles || []).includes(user?.role)) return true;
  if (isPartner(user) && (policy.partnerRoles || []).includes('partner')) return true;
  return false;
}

async function canReadRecord(user, collection, record) {
  const policy = getPolicy(collection);
  if (policy.publicRead) return true;
  if (!user) return false;
  if (isAdmin(user)) return true;

  const email = userEmail(user);
  const owner = await resolveOwnerEmail(collection, record);
  const ownerRead = policy.allowOwnerRW || policy.allowOwnerRead;
  if (ownerRead && owner && owner === email) return true;

  if (isPartner(user) && policy.partnerField) {
    const pe = (record[policy.partnerField] || '').toLowerCase();
    if (pe && pe === email) return true;
  }
  if (isPartner(user) && policy.resolveOwner === 'shop') {
    if (owner && owner === email) return true;
  }
  if (isPartner(user) && policy.ownerField === 'owner_email') {
    if (owner && owner === email) return true;
  }

  if (isDriver(user) && policy.driverField) {
    const de = (record[policy.driverField] || '').toLowerCase();
    if (de && de === email) return true;
  }
  if (isDriver(user) && policy.allowDriverReadUnassigned && collection === 'Order') {
    if (!record.driver_email && ['ready_for_pickup', 'pending_acceptance'].includes(record.status)) {
      return true;
    }
  }

  if (roleAllowed(user, policy) && !policy.ownerField && !policy.resolveOwner) return true;

  return false;
}

async function canWriteRecord(user, collection, record) {
  const policy = getPolicy(collection);
  if (isAdmin(user)) return true;

  const email = userEmail(user);
  const owner = await resolveOwnerEmail(collection, record);
  const ownerWrite = policy.allowOwnerRW || policy.allowOwnerWrite;
  if (ownerWrite && owner && owner === email) return true;

  if (isPartner(user) && (policy.allowPartnerRW || policy.allowOwnerRW)) {
    if (policy.partnerField) {
      const pe = (record[policy.partnerField] || '').toLowerCase();
      if (pe && pe === email) return true;
    }
    if (owner && owner === email) return true;
  }

  if (isDriver(user) && policy.allowDriverRW && collection === 'Order') {
    const status = normalizeOrderStatus(record.status);
    if (!record.driver_email && status === ORDER_STATUS.READY_FOR_PICKUP) {
      return true;
    }
    if (policy.driverField) {
      const de = (record[policy.driverField] || '').toLowerCase();
      if (de && de === email) return true;
    }
  }

  return false;
}

function canListCollection(user, collection) {
  const policy = getPolicy(collection);
  if (policy.publicRead) return true;
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (policy.allowOwnerRead || policy.allowOwnerRW) return true;
  if (isPartner(user) && (policy.partnerRoles || policy.allowPartnerRW || policy.resolveOwner)) return true;
  if (isDriver(user) && (policy.driverField || policy.allowDriverReadUnassigned)) return true;
  if (roleAllowed(user, policy)) return true;
  return false;
}

async function canCreateInCollection(user, collection, body) {
  const policy = getPolicy(collection);
  if (isAdmin(user)) return true;
  if (policy.allowOwnerRW || policy.allowOwnerWrite) {
    const owner = await resolveOwnerEmail(collection, body);
    if (collection === 'Order') {
      return body.customer_email?.toLowerCase() === userEmail(user) || !body.customer_email;
    }
    if (collection === 'Review') {
      return !body.customer_email || body.customer_email.toLowerCase() === userEmail(user);
    }
    if (owner && owner === userEmail(user)) return true;
    if (isPartner(user) && (policy.resolveOwner === 'shop' || policy.ownerField === 'owner_email')) {
      if (collection === 'Shop' || collection === 'Merchant') {
        return !body.owner_email || body.owner_email.toLowerCase() === userEmail(user);
      }
      return true;
    }
    if (isDriver(user) && collection === 'DriverIncident') return true;
    if (isDriver(user) && collection === 'DriverProfile') {
      return !body.email || body.email.toLowerCase() === userEmail(user);
    }
  }
  if (isPartner(user) && policy.allowPartnerRW) return true;
  return false;
}

async function filterVisible(user, collection, rows) {
  const policy = getPolicy(collection);
  if (policy.publicRead) return rows;
  if (!user) return [];
  if (isAdmin(user)) return rows;

  const email = userEmail(user);

  // Fast path: customer-owned rows (e.g. Order.customer_email)
  if (
    policy.ownerField &&
    (policy.allowOwnerRW || policy.allowOwnerRead) &&
    normalizeRole(user?.role) === 'customer'
  ) {
    return rows.filter(
      (r) => (r[policy.ownerField] || '').toLowerCase() === email
    );
  }

  // Fast path: driver order visibility
  if (isDriver(user) && collection === 'Order') {
    return rows.filter((r) => {
      const de = (r.driver_email || '').toLowerCase();
      if (de && de === email) return true;
      return !r.driver_email && ['ready_for_pickup', 'pending_acceptance'].includes(r.status);
    });
  }

  const out = [];
  for (const r of rows) {
    if (await canReadRecord(user, collection, r)) out.push(r);
  }
  return out;
}

function forbid(res, message = 'Forbidden') {
  return res.status(403).json({ message });
}

router.get('/:collection/list', async (req, res) => {
  try {
    const { collection } = req.params;
    if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });
    if (!canListCollection(req.user, collection)) return forbid(res);

    const { sort = '-created_date', limit = '50' } = req.query;
    const data = await localDb.entities[collection].list(sort, parseInt(limit, 10) || 50);
    res.json(await filterVisible(req.user, collection, data));
  } catch (err) {
    console.error(`[entities] GET /${req.params.collection}/list failed:`, err?.message || err);
    res.status(503).json({ message: 'Data temporarily unavailable, please retry' });
  }
});

router.get('/:collection/filter', async (req, res) => {
  try {
    const { collection } = req.params;
    if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });
    if (!canListCollection(req.user, collection)) return forbid(res);

    const filters = req.query.filters ? JSON.parse(req.query.filters) : {};
    const { sort = '-created_date', limit = '100' } = req.query;
    const data = await localDb.entities[collection].filter(filters, sort, parseInt(limit, 10) || 100);
    res.json(await filterVisible(req.user, collection, data));
  } catch (err) {
    console.error(`[entities] GET /${req.params.collection}/filter failed:`, err?.message || err);
    res.status(503).json({ message: 'Data temporarily unavailable, please retry' });
  }
});

router.post('/:collection', async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });

  try {
    return await createEntity(req, res, collection);
  } catch (err) {
    console.error(`[entities] POST /${collection} failed:`, err?.message || err);
    return res.status(503).json({ message: 'Could not save — please retry' });
  }
});

async function createEntity(req, res, collection) {
  const body = { ...req.body };

  // Never allow clients to invent wallet balances
  if (collection === 'Wallet' || collection === 'Transaction' || collection === 'Settlement') {
    if (!isAdmin(req.user)) return forbid(res, 'Direct wallet/settlement writes are not allowed');
  }

  // Customers must checkout via orderEngine.placeOrder (wallet applied server-side)
  if (collection === 'Order' && normalizeRole(req.user?.role) === 'customer') {
    return res.status(400).json({
      message: 'Use orderEngine.placeOrder for checkout — direct Order create is not allowed for customers',
    });
  }

  // Force ownership on create for customer-owned records
  if (collection === 'Order') {
    body.customer_email = req.user.email;
    body.customer_name = body.customer_name || req.user.full_name || '';
  }
  if (collection === 'Review') {
    body.customer_email = req.user.email;
  }
  if ((collection === 'Shop' || collection === 'Merchant') && isPartner(req.user)) {
    body.owner_email = req.user.email;
  }
  if (collection === 'Notification') {
    // users may only create notifications for themselves unless admin
    if (!isAdmin(req.user)) body.recipient_email = req.user.email;
  }
  if (collection === 'DriverIncident' && isDriver(req.user)) {
    body.driver_email = req.user.email;
  }
  if (collection === 'DriverProfile' && isDriver(req.user)) {
    body.email = req.user.email;
  }

  if (!(await canCreateInCollection(req.user, collection, body))) {
    return forbid(res);
  }

  // Partner creating catalog items must own the shop
  if (['MenuItem', 'Product', 'Branch', 'MerchantStaff', 'Promotion'].includes(collection) && isPartner(req.user)) {
    const owner = await resolveOwnerEmail(collection, body);
    if (owner && owner !== userEmail(req.user)) return forbid(res);
    if (!owner && (body.shop_id || body.merchant_id)) {
      const shops = await localDb.entities.Shop.filter({ id: body.shop_id || body.merchant_id }, '-created_date', 1);
      if (!shops[0] || shops[0].owner_email?.toLowerCase() !== userEmail(req.user)) return forbid(res);
    }
  }

  const item = await localDb.entities[collection].create(body);
  res.status(201).json(item);
}

router.patch('/:collection/:id', async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { collection, id } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });

  try {
    return await patchEntity(req, res, collection, id);
  } catch (err) {
    console.error(`[entities] PATCH /${collection}/${id} failed:`, err?.message || err);
    return res.status(503).json({ message: 'Could not save — please retry' });
  }
});

async function patchEntity(req, res, collection, id) {
  if (collection === 'Wallet' || collection === 'Transaction' || collection === 'Settlement') {
    if (!isAdmin(req.user)) return forbid(res, 'Direct wallet/settlement writes are not allowed');
  }

  const existing = (await localDb.entities[collection].filter({ id }, '-created_date', 1))[0];
  if (!existing) return res.status(404).json({ message: 'Not found' });

  if (!(await canWriteRecord(req.user, collection, existing))) return forbid(res);

  // Prevent ownership reassignment
  const body = { ...req.body };
  delete body.id;

  if (isDriver(req.user) && collection === 'Order' && !existing.driver_email) {
    const existingStatus = normalizeOrderStatus(existing.status);
    if (existingStatus === ORDER_STATUS.READY_FOR_PICKUP && body.driver_email) {
      const assignee = body.driver_email.toLowerCase();
      if (assignee !== userEmail(req.user)) {
        return forbid(res, 'Can only assign yourself as driver');
      }
    }
    if (existingStatus === ORDER_STATUS.READY_FOR_PICKUP && body.status) {
      body.driver_email = body.driver_email || req.user.email;
      body.driver_name = body.driver_name || req.user.full_name || req.user.email;
    }
  }

  if (!isAdmin(req.user)) {
    delete body.owner_email;
    delete body.customer_email;
    delete body.owner_type;
    if (collection === 'Wallet') delete body.balance;
    if (collection === 'Shop' || collection === 'Merchant') {
      delete body.approval_status;
      delete body.verification_status;
      delete body.rating;
      delete body.rating_count;
      delete body.owner_user_id;
    }
  }

  let item = await localDb.entities[collection].update(id, body);

  if (collection === 'Order' && body.driver_email && !existing.driver_email) {
    try {
      await reserveFloatForOrder(body.driver_email || req.user.email, { ...existing, ...item }, req.user.email);
    } catch (err) {
      console.error('reserveFloatForOrder failed:', err?.message || err);
    }
  }

  if (collection === 'Order' && body.status) {
    const prev = normalizeOrderStatus(existing.status);
    const next = normalizeOrderStatus(body.status);
    if (prev !== next) {
      void notifyOrderStatusChanged(item, body.status);
    }
    const settleStatuses = [ORDER_STATUS.DELIVERED, ORDER_STATUS.COMPLETED];
    if (settleStatuses.includes(next) && !item.settled_at) {
      try {
        await settleOrder(item);
        item = await localDb.entities.Order.update(id, {
          settled_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('settleOrder failed:', err?.message || err);
      }
    }
  }

  res.json(item);
}

router.delete('/:collection/:id', async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { collection, id } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });

  try {
    if (collection === 'Wallet' || collection === 'Transaction' || collection === 'Settlement') {
      if (!isAdmin(req.user)) return forbid(res);
    }

    const existing = (await localDb.entities[collection].filter({ id }, '-created_date', 1))[0];
    if (!existing) return res.status(404).json({ message: 'Not found' });
    if (!(await canWriteRecord(req.user, collection, existing))) return forbid(res);

    await localDb.entities[collection].delete(id);
    res.json({ id });
  } catch (err) {
    console.error(`[entities] DELETE /${collection}/${id} failed:`, err?.message || err);
    res.status(503).json({ message: 'Could not delete — please retry' });
  }
});

export default router;
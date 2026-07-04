import { Router } from 'express';
import { authMiddleware } from '../services/authentication/middleware.js';
import { localDb } from '../db/localDb.js';
import { getPolicy } from './entityPolicy.js';

const COLLECTIONS = Object.keys(localDb.entities);
const router = Router();

router.use(authMiddleware);

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
  if (isAdmin(user)) return true;
  if (policy.publicRead) return true;

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

  if (isDriver(user) && policy.allowDriverRW && policy.driverField) {
    const de = (record[policy.driverField] || '').toLowerCase();
    if (de && de === email) return true;
  }

  return false;
}

function canListCollection(user, collection) {
  const policy = getPolicy(collection);
  if (isAdmin(user)) return true;
  if (policy.publicRead) return true;
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
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });
  if (!canListCollection(req.user, collection)) return forbid(res);

  const { sort = '-created_date', limit = '50' } = req.query;
  const data = await localDb.entities[collection].list(sort, parseInt(limit, 10) || 50);
  res.json(await filterVisible(req.user, collection, data));
});

router.get('/:collection/filter', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });
  if (!canListCollection(req.user, collection)) return forbid(res);

  const filters = req.query.filters ? JSON.parse(req.query.filters) : {};
  const { sort = '-created_date', limit = '100' } = req.query;
  const data = await localDb.entities[collection].filter(filters, sort, parseInt(limit, 10) || 100);
  res.json(await filterVisible(req.user, collection, data));
});

router.post('/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });

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
});

router.patch('/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });

  if (collection === 'Wallet' || collection === 'Transaction' || collection === 'Settlement') {
    if (!isAdmin(req.user)) return forbid(res, 'Direct wallet/settlement writes are not allowed');
  }

  const existing = (await localDb.entities[collection].filter({ id }, '-created_date', 1))[0];
  if (!existing) return res.status(404).json({ message: 'Not found' });

  if (!(await canWriteRecord(req.user, collection, existing))) return forbid(res);

  // Prevent ownership reassignment
  const body = { ...req.body };
  delete body.id;
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

  const item = await localDb.entities[collection].update(id, body);
  res.json(item);
});

router.delete('/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;
  if (!COLLECTIONS.includes(collection)) return res.status(404).json({ message: 'Unknown collection' });

  if (collection === 'Wallet' || collection === 'Transaction' || collection === 'Settlement') {
    if (!isAdmin(req.user)) return forbid(res);
  }

  const existing = (await localDb.entities[collection].filter({ id }, '-created_date', 1))[0];
  if (!existing) return res.status(404).json({ message: 'Not found' });
  if (!(await canWriteRecord(req.user, collection, existing))) return forbid(res);

  await localDb.entities[collection].delete(id);
  res.json({ id });
});

export default router;

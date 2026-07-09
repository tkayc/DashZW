/**
 * PostgreSQL-backed entity CRUD (used when DATABASE_URL is set).
 * Maps legacy collection names (Shop, MenuItem) to merchants / products tables.
 */
import { query } from './pg.js';
import { notifyListeners } from './store.js';

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function applySort(items, sortKey) {
  if (!sortKey) return items;
  const desc = sortKey.startsWith('-');
  const key = desc ? sortKey.slice(1) : sortKey;
  const mapKey = {
    created_date: 'created_at',
    updated_date: 'updated_at',
  }[key] || key;
  return [...items].sort((a, b) => {
    const av = a[mapKey] ?? a[key] ?? '';
    const bv = b[mapKey] ?? b[key] ?? '';
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function merchantToShop(row) {
  if (!row) return null;
  const meta = parseMerchantMetadata(row.metadata);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category_id,
    image_url: row.image_url,
    cover_url: row.cover_url,
    phone: row.phone,
    owner_email: row.owner_email,
    owner_user_id: row.owner_user_id,
    approval_status: row.approval_status,
    verification_status: row.verification_status,
    rating: row.rating != null ? Number(row.rating) : 0,
    rating_count: row.rating_count || 0,
    is_open: row.is_open,
    opening_hours: row.opening_hours || row.branch_operating_hours || null,
    min_order_amount: row.min_order_amount != null ? Number(row.min_order_amount) : 0,
    address: row.address,
    city: row.city,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    estimated_delivery_time: row.estimated_delivery_time || row.branch_eta || null,
    default_branch_id: row.default_branch_id,
    brand_color: row.brand_color,
    ecocash_number: meta.ecocash_number || '',
    ecocash_name: meta.ecocash_name || '',
    bank_name: meta.bank_name || '',
    bank_account: meta.bank_account || '',
    bank_account_name: meta.bank_account_name || '',
    bank_branch: meta.bank_branch || '',
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

const MERCHANT_PAYOUT_FIELDS = [
  'ecocash_number',
  'ecocash_name',
  'bank_name',
  'bank_account',
  'bank_account_name',
  'bank_branch',
];

function parseMerchantMetadata(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw || {};
}

async function buildMerchantMetadataPatch(merchantId, data) {
  const patch = {};
  for (const key of MERCHANT_PAYOUT_FIELDS) {
    if (data[key] !== undefined) patch[key] = data[key];
  }
  if (!Object.keys(patch).length) return null;

  const cur = await query('SELECT metadata FROM merchants WHERE id = $1', [merchantId]);
  const merged = { ...parseMerchantMetadata(cur.rows[0]?.metadata), ...patch };
  return merged;
}

async function syncDefaultBranchFromMerchant(merchantRow, data) {
  const branchId = merchantRow.default_branch_id;
  if (!branchId) return;

  const branchMap = {
    opening_hours: 'operating_hours',
    estimated_delivery_time: 'estimated_delivery_time',
    address: 'address',
    city: 'city',
    phone: 'phone',
    is_open: 'is_open',
  };

  const fields = [];
  const vals = [];
  let i = 1;
  for (const [apiKey, col] of Object.entries(branchMap)) {
    if (data[apiKey] === undefined) continue;
    fields.push(`${col} = $${i++}`);
    vals.push(data[apiKey]);
  }
  if (!fields.length) return;

  fields.push('updated_at = NOW()');
  vals.push(branchId);
  await query(
    `UPDATE merchant_branches SET ${fields.join(', ')} WHERE id = $${i}`,
    vals
  );
}

function productToMenuItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    shop_id: row.merchant_id,
    merchant_id: row.merchant_id,
    branch_id: row.branch_id,
    name: row.name,
    description: row.description,
    price: row.price != null ? Number(row.price) : 0,
    category: row.category_name,
    image_url: row.image_url,
    sku: row.sku,
    barcode: row.barcode,
    is_popular: row.is_popular,
    is_available: row.is_available,
    prep_minutes: row.prep_minutes,
    created_date: row.created_at,
    updated_date: row.updated_at,
    images: [],
    image_urls: row.image_url ? [row.image_url] : [],
    variants: [],
    addons: [],
  };
}

async function loadProductExtras(productId) {
  const [images, variants, addons] = await Promise.all([
    query(
      `SELECT id, url, sort_order FROM product_images WHERE product_id = $1 ORDER BY sort_order, id`,
      [productId]
    ),
    query(
      `SELECT id, name, price_delta, is_default, is_available FROM product_variants WHERE product_id = $1 ORDER BY is_default DESC, name`,
      [productId]
    ),
    query(
      `SELECT id, name, price, is_available FROM product_addons WHERE product_id = $1 ORDER BY name`,
      [productId]
    ),
  ]);

  return {
    images: images.rows.map((r) => ({ id: r.id, url: r.url, sort_order: r.sort_order })),
    variants: variants.rows.map((r) => ({
      id: r.id,
      name: r.name,
      priceDelta: Number(r.price_delta),
      price_delta: Number(r.price_delta),
      is_default: r.is_default,
      is_available: r.is_available,
    })),
    addons: addons.rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: Number(r.price),
      is_available: r.is_available,
    })),
  };
}

/**
 * Batched version of loadProductExtras — fetches images/variants/addons for
 * MANY products in 3 queries total instead of 3 queries PER product.
 * Fixes an N+1 that made shop menu pages (50 items = 150 queries) slow.
 */
async function loadProductExtrasBatch(productIds) {
  const empty = () => new Map();
  if (!productIds?.length) {
    return { imagesByProduct: empty(), variantsByProduct: empty(), addonsByProduct: empty() };
  }

  const [images, variants, addons] = await Promise.all([
    query(
      `SELECT id, product_id, url, sort_order FROM product_images WHERE product_id = ANY($1::text[]) ORDER BY product_id, sort_order, id`,
      [productIds]
    ),
    query(
      `SELECT id, product_id, name, price_delta, is_default, is_available FROM product_variants WHERE product_id = ANY($1::text[]) ORDER BY product_id, is_default DESC, name`,
      [productIds]
    ),
    query(
      `SELECT id, product_id, name, price, is_available FROM product_addons WHERE product_id = ANY($1::text[]) ORDER BY product_id, name`,
      [productIds]
    ),
  ]);

  const groupBy = (rows, mapRow) => {
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.product_id)) map.set(row.product_id, []);
      map.get(row.product_id).push(mapRow(row));
    }
    return map;
  };

  return {
    imagesByProduct: groupBy(images.rows, (r) => ({ id: r.id, url: r.url, sort_order: r.sort_order })),
    variantsByProduct: groupBy(variants.rows, (r) => ({
      id: r.id,
      name: r.name,
      priceDelta: Number(r.price_delta),
      price_delta: Number(r.price_delta),
      is_default: r.is_default,
      is_available: r.is_available,
    })),
    addonsByProduct: groupBy(addons.rows, (r) => ({ id: r.id, name: r.name, price: Number(r.price), is_available: r.is_available })),
  };
}

function enrichProductItemWithExtras(item, extras) {
  const imageUrls = extras.images.length
    ? extras.images.map((i) => i.url)
    : item.image_url
      ? [item.image_url]
      : [];
  return {
    ...item,
    images: extras.images,
    image_urls: imageUrls,
    variants: extras.variants,
    addons: extras.addons,
    image_url: imageUrls[0] || item.image_url || null,
  };
}

async function enrichProductItem(item) {
  if (!item?.id) return item;
  const extras = await loadProductExtras(item.id);
  const imageUrls = extras.images.length
    ? extras.images.map((i) => i.url)
    : item.image_url
      ? [item.image_url]
      : [];
  return {
    ...item,
    images: extras.images,
    image_urls: imageUrls,
    variants: extras.variants,
    addons: extras.addons,
    image_url: imageUrls[0] || item.image_url || null,
  };
}

async function saveProductExtras(productId, data) {
  if (data.images != null) {
    await query(`DELETE FROM product_images WHERE product_id = $1`, [productId]);
    const images = Array.isArray(data.images) ? data.images : [];
    for (let i = 0; i < images.length; i++) {
      const url = typeof images[i] === 'string' ? images[i] : images[i]?.url;
      if (!url) continue;
      await query(
        `INSERT INTO product_images (id, product_id, url, sort_order) VALUES ($1,$2,$3,$4)`,
        [generateId('pimg'), productId, url, i]
      );
    }
    const primary = images.length
      ? (typeof images[0] === 'string' ? images[0] : images[0]?.url)
      : data.image_url ?? null;
    if (primary) {
      await query(`UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2`, [primary, productId]);
    }
  }

  if (data.variants != null) {
    await query(`DELETE FROM product_variants WHERE product_id = $1`, [productId]);
    for (const v of data.variants) {
      if (!v?.name?.trim()) continue;
      await query(
        `INSERT INTO product_variants (id, product_id, name, price_delta, is_default, is_available)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          v.id || generateId('pvar'),
          productId,
          v.name.trim(),
          Number(v.priceDelta ?? v.price_delta ?? 0),
          !!v.is_default,
          v.is_available !== false,
        ]
      );
    }
  }

  if (data.addons != null) {
    await query(`DELETE FROM product_addons WHERE product_id = $1`, [productId]);
    for (const a of data.addons) {
      if (!a?.name?.trim()) continue;
      await query(
        `INSERT INTO product_addons (id, product_id, name, price, is_available)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          a.id || generateId('padd'),
          productId,
          a.name.trim(),
          Number(a.price || 0),
          a.is_available !== false,
        ]
      );
    }
  }
}

function branchToApi(row) {
  if (!row) return null;
  return {
    id: row.id,
    merchant_id: row.merchant_id,
    shop_id: row.merchant_id,
    name: row.name,
    address: row.address,
    city: row.city,
    phone: row.phone,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    opening_hours: row.operating_hours,
    operating_hours: row.operating_hours,
    manager_email: row.manager_email,
    delivery_radius_km: row.delivery_radius_km != null ? Number(row.delivery_radius_km) : 8,
    estimated_delivery_time: row.estimated_delivery_time,
    status: row.status,
    is_open: row.is_open,
    is_default: row.is_default,
    images: row.images || [],
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

function orderToApi(row) {
  if (!row) return null;
  const pack =
    typeof row.pack_progress === 'string'
      ? JSON.parse(row.pack_progress || '{}')
      : (row.pack_progress || {});
  const courierMeta = pack?.courier_meta || {};
  return {
    ...row,
    partner_subtotal: num(row.partner_subtotal),
    platform_fee: num(row.platform_fee),
    customer_subtotal: num(row.customer_subtotal),
    delivery_fee: num(row.delivery_fee),
    raw_delivery_fee: num(row.raw_delivery_fee),
    service_fee: num(row.service_fee),
    discount_amount: num(row.discount_amount),
    admin_discount_amount: num(row.admin_discount_amount),
    total: num(row.total),
    wallet_applied: num(row.wallet_applied),
    driver_tip: num(row.driver_tip),
    partner_payout: num(row.partner_payout),
    platform_earning: num(row.platform_earning),
    driver_earning: num(row.driver_earning),
    refunded_amount: num(row.refunded_amount),
    distance_km: row.distance_km != null ? Number(row.distance_km) : null,
    estimated_arrival_mins: row.estimated_arrival_mins != null ? Number(row.estimated_arrival_mins) : null,
    shop_lat: row.shop_lat != null ? Number(row.shop_lat) : null,
    shop_lng: row.shop_lng != null ? Number(row.shop_lng) : null,
    dest_lat: row.dest_lat != null ? Number(row.dest_lat) : null,
    dest_lng: row.dest_lng != null ? Number(row.dest_lng) : null,
    driver_lat: row.driver_lat != null ? Number(row.driver_lat) : null,
    driver_lng: row.driver_lng != null ? Number(row.driver_lng) : null,
    created_date: row.created_at,
    updated_date: row.updated_at,
    items: typeof row.items_json === 'string' ? JSON.parse(row.items_json) : (row.items_json || row.items || []),
    // Courier fields stored in pack_progress.courier_meta (no dedicated PG columns yet)
    order_kind: courierMeta.order_kind || row.order_kind || (row.merchant_category === 'courier' ? 'courier' : undefined),
    required_vehicle_type: courierMeta.required_vehicle_type || row.required_vehicle_type || null,
    package_description: courierMeta.package_description || row.package_description || null,
    pickup_address: courierMeta.pickup_address || row.pickup_address || row.shop_address || null,
    pickup_lat: courierMeta.pickup_lat ?? row.pickup_lat ?? (row.shop_lat != null ? Number(row.shop_lat) : null),
    pickup_lng: courierMeta.pickup_lng ?? row.pickup_lng ?? (row.shop_lng != null ? Number(row.shop_lng) : null),
    pack_progress: pack,
  };
}

function num(v) {
  return v != null ? Number(v) : 0;
}

function rowToGeneric(row) {
  if (!row) return null;
  return {
    ...row,
    created_date: row.created_at || row.created_date,
    updated_date: row.updated_at || row.updated_date,
    balance: row.balance != null ? Number(row.balance) : row.balance,
    amount: row.amount != null ? Number(row.amount) : row.amount,
    points: row.points != null ? Number(row.points) : row.points,
  };
}

const TABLE_MAP = {
  Shop: { table: 'merchants', map: merchantToShop, orderBy: 'created_at' },
  Merchant: { table: 'merchants', map: merchantToShop, orderBy: 'created_at' },
  MenuItem: { table: 'products', map: productToMenuItem, orderBy: 'created_at' },
  Product: { table: 'products', map: productToMenuItem, orderBy: 'created_at' },
  Branch: { table: 'merchant_branches', map: branchToApi, orderBy: 'created_at' },
  MerchantStaff: { table: 'merchant_staff', map: rowToGeneric, orderBy: 'created_at' },
  Order: { table: 'orders', map: orderToApi, orderBy: 'created_at', hasItems: true },
  Review: { table: 'reviews', map: rowToGeneric, orderBy: 'created_at' },
  Promotion: { table: 'promotions', map: rowToGeneric, orderBy: 'created_at' },
  Wallet: { table: 'wallets', map: rowToGeneric, orderBy: 'created_at' },
  Transaction: { table: 'transactions', map: rowToGeneric, orderBy: 'created_at' },
  DriverProfile: { table: 'driver_profiles', map: rowToGeneric, orderBy: 'updated_at' },
  Notification: { table: 'notifications', map: rowToGeneric, orderBy: 'created_at' },
  AdminPromotion: { table: 'admin_promotions', map: rowToGeneric, orderBy: 'created_at' },
  Settlement: { table: 'settlements', map: rowToGeneric, orderBy: 'created_at' },
  Withdrawal: { table: 'withdrawals', map: rowToGeneric, orderBy: 'created_at' },
  Referral: { table: 'referrals', map: rowToGeneric, orderBy: 'created_at' },
  LoyaltyPoints: { table: 'loyalty_points', map: rowToGeneric, orderBy: 'updated_at' },
  DriverIncident: { table: 'driver_incidents', map: rowToGeneric, orderBy: 'created_at' },
};

async function loadOrderItems(orderId) {
  const r = await query(
    `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`,
    [orderId]
  );
  return mapOrderItemRows(r.rows);
}

function mapOrderItemRows(rows) {
  return rows.map((i) => ({
    menu_item_id: i.menu_item_id || i.product_id,
    product_id: i.product_id,
    name: i.name,
    price: Number(i.price),
    quantity: i.quantity,
    packed_quantity: i.packed_quantity,
    variant_id: i.variant_id,
    variant_name: i.variant_name,
    addon_ids: i.addon_ids || [],
    addon_names: i.addon_names || [],
    image_url: i.image_url,
    unavailable: i.unavailable,
    replacement_pending: i.replacement_pending,
    replacement_options: i.replacement_options || [],
    swapped_from_name: i.swapped_from_name,
  }));
}

async function loadOrderItemsBatch(orderIds) {
  if (!orderIds.length) return new Map();
  const r = await query(
    `SELECT * FROM order_items WHERE order_id = ANY($1::text[]) ORDER BY order_id, id`,
    [orderIds]
  );
  const map = new Map();
  for (const row of r.rows) {
    if (!map.has(row.order_id)) map.set(row.order_id, []);
    map.get(row.order_id).push(mapOrderItemRows([row])[0]);
  }
  return map;
}

async function fetchAll(collection, sortKey, limit) {
  const meta = TABLE_MAP[collection];
  if (!meta) return [];

  const orderCol = meta.orderBy || 'updated_at';

  if (collection === 'Order' || collection === 'orders') {
    const r = await query(
      `SELECT * FROM orders ORDER BY ${orderCol} DESC NULLS LAST LIMIT $1`,
      [limit]
    );
    const itemsByOrder = await loadOrderItemsBatch(r.rows.map((row) => row.id));
    const rows = r.rows.map((row) =>
      orderToApi({ ...row, items_json: itemsByOrder.get(row.id) || [] })
    );
    return applySort(rows, sortKey).slice(0, limit);
  }

  if (collection === 'Shop' || collection === 'Merchant') {
    const r = await query(
      `SELECT m.*, b.operating_hours AS branch_operating_hours, b.estimated_delivery_time AS branch_eta
       FROM merchants m
       LEFT JOIN merchant_branches b ON b.id = m.default_branch_id
       ORDER BY m.${orderCol} DESC NULLS LAST LIMIT $1`,
      [limit]
    );
    const rows = r.rows.map((row) => merchantToShop(row));
    return applySort(rows, sortKey).slice(0, limit);
  }

  const r = await query(
    `SELECT * FROM ${meta.table} ORDER BY ${orderCol} DESC NULLS LAST LIMIT $1`,
    [limit]
  );
  const rows = r.rows.map(meta.map);
  return applySort(rows, sortKey).slice(0, limit);
}

function matchesFilters(item, filters) {
  return Object.entries(filters).every(([k, v]) => {
    if (k === 'shop_id' && item.merchant_id) return item.shop_id === v || item.merchant_id === v;
    if (['recipient_email', 'customer_email', 'owner_email', 'email', 'partner_email', 'driver_email'].includes(k)) {
      return String(item[k] || '').toLowerCase() === String(v || '').toLowerCase();
    }
    if (k === 'is_active' || k === 'is_available' || k === 'is_open') {
      return Boolean(item[k]) === Boolean(v);
    }
    return item[k] === v;
  });
}

async function filterMerchantsSql(filters, sortKey, limit) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filters.id) {
    conditions.push(`m.id = $${i++}`);
    vals.push(filters.id);
  }
  if (filters.owner_email) {
    conditions.push(`LOWER(m.owner_email) = LOWER($${i++})`);
    vals.push(filters.owner_email);
  }
  if (filters.approval_status) {
    conditions.push(`m.approval_status = $${i++}`);
    vals.push(filters.approval_status);
  }
  if (filters.category || filters.category_id) {
    conditions.push(`m.category_id = $${i++}`);
    vals.push(filters.category || filters.category_id);
  }

  const orderKey = sortKey?.startsWith('-') ? sortKey.slice(1) : sortKey;
  const orderCol = { created_date: 'created_at', updated_date: 'updated_at' }[orderKey] || orderKey || 'created_at';
  const desc = sortKey?.startsWith('-') !== false;
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const r = await query(
    `SELECT m.*, b.operating_hours AS branch_operating_hours, b.estimated_delivery_time AS branch_eta
     FROM merchants m
     LEFT JOIN merchant_branches b ON b.id = m.default_branch_id
     ${where}
     ORDER BY m.${orderCol} ${desc ? 'DESC' : 'ASC'} NULLS LAST
     LIMIT $${i}`,
    [...vals, limit]
  );
  return r.rows.map((row) => merchantToShop(row));
}

async function filterProductsSql(filters, sortKey, limit) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filters.id) {
    conditions.push(`id = $${i++}`);
    vals.push(filters.id);
  }
  const merchantId = filters.shop_id || filters.merchant_id;
  if (merchantId) {
    conditions.push(`merchant_id = $${i++}`);
    vals.push(merchantId);
  }
  if (filters.is_available !== undefined) {
    conditions.push(`is_available = $${i++}`);
    vals.push(filters.is_available);
  }

  const orderKey = sortKey?.startsWith('-') ? sortKey.slice(1) : sortKey;
  const orderCol = { created_date: 'created_at', updated_date: 'updated_at' }[orderKey] || orderKey || 'created_at';
  const desc = sortKey?.startsWith('-') !== false;
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const r = await query(
    `SELECT * FROM products ${where} ORDER BY ${orderCol} ${desc ? 'DESC' : 'ASC'} NULLS LAST LIMIT $${i}`,
    [...vals, limit]
  );
  const rows = r.rows.map((row) => productToMenuItem(row));
  const { imagesByProduct, variantsByProduct, addonsByProduct } = await loadProductExtrasBatch(
    rows.map((row) => row.id)
  );
  return rows.map((item) =>
    enrichProductItemWithExtras(item, {
      images: imagesByProduct.get(item.id) || [],
      variants: variantsByProduct.get(item.id) || [],
      addons: addonsByProduct.get(item.id) || [],
    })
  );
}

async function filterOrdersSql(filters, sortKey, limit) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filters.id) {
    conditions.push(`id = $${i++}`);
    vals.push(filters.id);
  }
  const shopId = filters.shop_id || filters.merchant_id;
  if (shopId) {
    conditions.push(`shop_id = $${i++}`);
    vals.push(shopId);
  }
  if (filters.partner_email) {
    conditions.push(`LOWER(partner_email::text) = LOWER($${i++})`);
    vals.push(filters.partner_email);
  }
  if (filters.customer_email) {
    conditions.push(`LOWER(customer_email::text) = LOWER($${i++})`);
    vals.push(filters.customer_email);
  }
  if (filters.driver_email) {
    conditions.push(`LOWER(driver_email::text) = LOWER($${i++})`);
    vals.push(filters.driver_email);
  }
  if (filters.status) {
    conditions.push(`status = $${i++}`);
    vals.push(filters.status);
  }

  const orderKey = sortKey?.startsWith('-') ? sortKey.slice(1) : sortKey;
  const orderCol = { created_date: 'created_at', updated_date: 'updated_at' }[orderKey] || orderKey || 'created_at';
  const desc = sortKey?.startsWith('-') !== false;
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const r = await query(
    `SELECT * FROM orders ${where} ORDER BY ${orderCol} ${desc ? 'DESC' : 'ASC'} NULLS LAST LIMIT $${i}`,
    [...vals, limit]
  );
  const itemsByOrder = await loadOrderItemsBatch(r.rows.map((row) => row.id));
  return r.rows.map((row) =>
    orderToApi({ ...row, items_json: itemsByOrder.get(row.id) || [] })
  );
}

function canUseMerchantSqlFilter(filters) {
  return Boolean(filters.id || filters.owner_email || filters.approval_status || filters.category || filters.category_id);
}

function canUseProductSqlFilter(filters) {
  return Boolean(filters.id || filters.shop_id || filters.merchant_id || filters.is_available !== undefined);
}

function canUseOrderSqlFilter(filters) {
  return Boolean(
    filters.id ||
    filters.shop_id ||
    filters.merchant_id ||
    filters.partner_email ||
    filters.customer_email ||
    filters.driver_email ||
    filters.status
  );
}

export function makePgEntity(collectionName) {
  const meta = TABLE_MAP[collectionName];
  return {
    list: async (sortKey = '-created_date', limit = 50) => fetchAll(collectionName, sortKey, limit),

    filter: async (filters = {}, sortKey = '-created_date', limit = 100) => {
      if ((collectionName === 'Shop' || collectionName === 'Merchant') && canUseMerchantSqlFilter(filters)) {
        return filterMerchantsSql(filters, sortKey, limit);
      }
      if ((collectionName === 'MenuItem' || collectionName === 'Product') && canUseProductSqlFilter(filters)) {
        return filterProductsSql(filters, sortKey, limit);
      }
      if (collectionName === 'Order' && canUseOrderSqlFilter(filters)) {
        return filterOrdersSql(filters, sortKey, limit);
      }
      const all = await fetchAll(collectionName, sortKey, Math.max(limit, 500));
      return all.filter((item) => matchesFilters(item, filters)).slice(0, limit);
    },

    create: async (data) => {
      if (collectionName === 'Shop' || collectionName === 'Merchant') {
        const id = data.id || generateId('mrc');
        const r = await query(
          `INSERT INTO merchants (
            id, name, description, category_id, image_url, phone, owner_email, owner_user_id,
            approval_status, verification_status, rating, is_open, opening_hours, min_order_amount,
            address, city, lat, lng, estimated_delivery_time, default_branch_id
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
          ) RETURNING *`,
          [
            id,
            data.name,
            data.description || null,
            data.category || data.category_id || 'other',
            data.image_url || null,
            data.phone || null,
            data.owner_email,
            data.owner_user_id || null,
            data.approval_status || 'pending',
            data.verification_status || 'unverified',
            data.rating || 0,
            data.is_open !== false,
            data.opening_hours || null,
            data.min_order_amount || 0,
            data.address || null,
            data.city || null,
            data.lat ?? null,
            data.lng ?? null,
            data.estimated_delivery_time || null,
            data.default_branch_id || null,
          ]
        );
        return merchantToShop(r.rows[0]);
      }

      if (collectionName === 'MenuItem' || collectionName === 'Product') {
        const id = data.id || generateId('prd');
        const merchantId = data.merchant_id || data.shop_id;
        const r = await query(
          `INSERT INTO products (
            id, merchant_id, branch_id, category_name, name, description, price, image_url,
            sku, is_popular, is_available
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [
            id,
            merchantId,
            data.branch_id || null,
            data.category || data.category_name || null,
            data.name,
            data.description || null,
            data.price || 0,
            data.image_url || null,
            data.sku || null,
            !!data.is_popular,
            data.is_available !== false,
          ]
        );
        await saveProductExtras(id, data);
        return await enrichProductItem(productToMenuItem(r.rows[0]));
      }

      if (collectionName === 'Order') {
        const id = data.id || generateId('ord');
        const items = data.items || [];
        const r = await query(
          `INSERT INTO orders (
            id, customer_email, customer_name, customer_phone, merchant_id, merchant_name,
            merchant_category, branch_id, partner_email, shop_id, shop_name, shop_address,
            shop_lat, shop_lng, status, is_pickup, delivery_address, delivery_city,
            delivery_notes, delivery_instructions, special_notes, dest_lat, dest_lng,
            distance_km, estimated_arrival_mins, delivery_code, payment_method,
            partner_subtotal, platform_fee, customer_subtotal, delivery_fee, raw_delivery_fee,
            service_fee, discount_amount, admin_discount_amount, wallet_applied, driver_tip,
            total, partner_payout, platform_earning, driver_earning, is_free_delivery,
            promo_id, promo_title, admin_promo_id, admin_promo_title, driver_email, driver_name,
            pack_progress, scheduled_time, is_scheduled
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
            $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,
            $39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51
          ) RETURNING *`,
          [
            id,
            data.customer_email,
            data.customer_name || null,
            data.customer_phone || null,
            data.merchant_id || data.shop_id,
            data.merchant_name || data.shop_name || null,
            data.merchant_category || null,
            data.branch_id || null,
            data.partner_email || null,
            data.shop_id || data.merchant_id,
            data.shop_name || data.merchant_name || null,
            data.shop_address || null,
            data.shop_lat ?? null,
            data.shop_lng ?? null,
            data.status || 'pending_acceptance',
            !!data.is_pickup,
            data.delivery_address || null,
            data.delivery_city || null,
            data.delivery_notes || null,
            data.delivery_instructions || null,
            data.special_notes || null,
            data.dest_lat ?? null,
            data.dest_lng ?? null,
            data.distance_km ?? null,
            data.estimated_arrival_mins ?? null,
            data.delivery_code || null,
            data.payment_method || null,
            data.partner_subtotal || 0,
            data.platform_fee || 0,
            data.customer_subtotal || 0,
            data.delivery_fee || 0,
            data.raw_delivery_fee || 0,
            data.service_fee || 0,
            data.discount_amount || 0,
            data.admin_discount_amount || 0,
            data.wallet_applied || 0,
            data.driver_tip || 0,
            data.total || 0,
            data.partner_payout || 0,
            data.platform_earning || 0,
            data.driver_earning || 0,
            !!data.is_free_delivery,
            data.promo_id || null,
            data.promo_title || null,
            data.admin_promo_id || null,
            data.admin_promo_title || null,
            data.driver_email || null,
            data.driver_name || null,
            JSON.stringify(
              data.order_kind === 'courier'
                ? {
                    ...(typeof data.pack_progress === 'object' && data.pack_progress ? data.pack_progress : {}),
                    courier_meta: {
                      order_kind: 'courier',
                      required_vehicle_type: data.required_vehicle_type || null,
                      package_description: data.package_description || data.special_notes || null,
                      pickup_address: data.pickup_address || data.shop_address || null,
                      pickup_lat: data.pickup_lat ?? data.shop_lat ?? null,
                      pickup_lng: data.pickup_lng ?? data.shop_lng ?? null,
                    },
                  }
                : (data.pack_progress || {})
            ),
            data.scheduled_time || null,
            !!data.is_scheduled,
          ]
        );
        for (const item of items) {
          await query(
            `INSERT INTO order_items (
              order_id, product_id, menu_item_id, name, price, quantity, packed_quantity,
              variant_id, variant_name, addon_ids, addon_names, image_url, unavailable,
              replacement_pending, replacement_options
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
            [
              id,
              item.product_id || item.menu_item_id || null,
              item.menu_item_id || item.product_id || null,
              item.name,
              item.price || 0,
              item.quantity || 1,
              item.packed_quantity || 0,
              item.variant_id || null,
              item.variant_name || null,
              JSON.stringify(item.addon_ids || []),
              JSON.stringify(item.addon_names || []),
              item.image_url || null,
              !!item.unavailable,
              !!item.replacement_pending,
              JSON.stringify(item.replacement_options || []),
            ]
          );
        }
        return orderToApi({ ...r.rows[0], items_json: items });
      }

      // Generic insert for simple tables
      if (!meta) throw new Error(`Unsupported collection ${collectionName}`);
      const id = data.id || generateId(collectionName.slice(0, 3).toLowerCase());
      const payload = { ...data, id };
      delete payload.created_date;
      delete payload.updated_date;
      // Fallback: store as JSON-compatible row via dynamic columns for known simple tables
      if (collectionName === 'Notification') {
        const r = await query(
          `INSERT INTO notifications (id, recipient_email, title, body, type, category, channel, link, is_read)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [
            id,
            payload.recipient_email,
            payload.title,
            payload.body || null,
            payload.type || null,
            payload.category || 'system',
            payload.channel || 'in_app',
            payload.link || null,
            !!payload.is_read,
          ]
        );
        notifyListeners('Notification');
        return rowToGeneric(r.rows[0]);
      }
      if (collectionName === 'Wallet') {
        const r = await query(
          `INSERT INTO wallets (id, owner_email, owner_type, balance)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [id, payload.owner_email, payload.owner_type || 'customer', payload.balance || 0]
        );
        return rowToGeneric(r.rows[0]);
      }
      if (collectionName === 'DriverIncident') {
        const r = await query(
          `INSERT INTO driver_incidents (id, driver_email, driver_name, order_id, type, description, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [
            id,
            payload.driver_email,
            payload.driver_name || null,
            payload.order_id || null,
            payload.type,
            payload.description || null,
            payload.status || 'open',
          ]
        );
        return rowToGeneric(r.rows[0]);
      }
      if (collectionName === 'Review') {
        const r = await query(
          `INSERT INTO reviews (id, order_id, merchant_id, shop_id, customer_email, customer_name, merchant_rating, driver_rating, comment)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [
            id,
            payload.order_id || null,
            payload.merchant_id || payload.shop_id || null,
            payload.shop_id || payload.merchant_id || null,
            payload.customer_email || null,
            payload.customer_name || null,
            payload.merchant_rating || payload.rating || null,
            payload.driver_rating || null,
            payload.comment || payload.body || null,
          ]
        );
        return rowToGeneric(r.rows[0]);
      }
      if (collectionName === 'AdminPromotion') {
        const r = await query(
          `INSERT INTO admin_promotions (id, title, promo_type, coupon_code, discount_value, min_order, is_active, new_users_only)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [
            id,
            payload.title,
            payload.promo_type || 'platform_discount',
            payload.coupon_code || null,
            payload.discount_value || 0,
            payload.min_order || 0,
            payload.is_active !== false,
            !!payload.new_users_only,
          ]
        );
        return rowToGeneric(r.rows[0]);
      }

      throw new Error(`Create not implemented for ${collectionName} on PostgreSQL`);
    },

    update: async (id, data) => {
      if (collectionName === 'Shop' || collectionName === 'Merchant') {
        const fields = [];
        const vals = [];
        let i = 1;
        const map = {
          name: 'name',
          description: 'description',
          category: 'category_id',
          image_url: 'image_url',
          cover_url: 'cover_url',
          phone: 'phone',
          approval_status: 'approval_status',
          verification_status: 'verification_status',
          is_open: 'is_open',
          opening_hours: 'opening_hours',
          min_order_amount: 'min_order_amount',
          estimated_delivery_time: 'estimated_delivery_time',
          address: 'address',
          city: 'city',
          lat: 'lat',
          lng: 'lng',
          rating: 'rating',
          default_branch_id: 'default_branch_id',
        };
        for (const [k, col] of Object.entries(map)) {
          if (data[k] !== undefined) {
            fields.push(`${col} = $${i++}`);
            vals.push(data[k]);
          }
        }

        const metadataPatch = await buildMerchantMetadataPatch(id, data);
        if (metadataPatch) {
          fields.push(`metadata = $${i++}::jsonb`);
          vals.push(JSON.stringify(metadataPatch));
        }

        if (!fields.length) {
          throw new Error('No valid shop fields to update');
        }

        fields.push('updated_at = NOW()');
        vals.push(id);
        const r = await query(
          `UPDATE merchants SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
          vals
        );
        if (!r.rows[0]) throw new Error(`Item ${id} not found in ${collectionName}`);

        await syncDefaultBranchFromMerchant(r.rows[0], data);
        notifyListeners('Shop');
        notifyListeners('Branch');

        return merchantToShop(r.rows[0]);
      }

      if (collectionName === 'Branch') {
        const map = {
          name: 'name',
          address: 'address',
          city: 'city',
          phone: 'phone',
          lat: 'lat',
          lng: 'lng',
          opening_hours: 'operating_hours',
          operating_hours: 'operating_hours',
          estimated_delivery_time: 'estimated_delivery_time',
          is_open: 'is_open',
          delivery_radius_km: 'delivery_radius_km',
          pickup_lat: 'pickup_lat',
          pickup_lng: 'pickup_lng',
        };
        const fields = [];
        const vals = [];
        let i = 1;
        for (const [k, col] of Object.entries(map)) {
          if (data[k] !== undefined) {
            fields.push(`${col} = $${i++}`);
            vals.push(data[k]);
          }
        }
        if (!fields.length) throw new Error('No valid branch fields to update');
        fields.push('updated_at = NOW()');
        vals.push(id);
        const r = await query(
          `UPDATE merchant_branches SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
          vals
        );
        if (!r.rows[0]) throw new Error(`Item ${id} not found in Branch`);
        notifyListeners('Branch');
        return branchToApi(r.rows[0]);
      }

      if (collectionName === 'Order') {
        const allowed = [
          'status', 'driver_email', 'driver_name', 'driver_phone', 'driver_lat', 'driver_lng',
          'pack_progress', 'cancel_reason', 'refunded_amount', 'items',
          'settled_at', 'delivered_at',
        ];
        const fields = [];
        const vals = [];
        let i = 1;
        for (const k of allowed) {
          if (data[k] === undefined) continue;
          if (k === 'items') continue;
          if (k === 'pack_progress') {
            fields.push(`pack_progress = $${i++}`);
            vals.push(JSON.stringify(data[k]));
          } else {
            fields.push(`${k} = $${i++}`);
            vals.push(data[k]);
          }
        }
        fields.push('updated_at = NOW()');
        vals.push(id);
        const r = await query(
          `UPDATE orders SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
          vals
        );
        if (!r.rows[0]) throw new Error(`Item ${id} not found in Order`);
        if (data.items) {
          await query(`DELETE FROM order_items WHERE order_id = $1`, [id]);
          for (const item of data.items) {
            await query(
              `INSERT INTO order_items (
                order_id, product_id, menu_item_id, name, price, quantity, packed_quantity,
                variant_id, variant_name, addon_ids, addon_names, image_url, unavailable,
                replacement_pending, replacement_options, swapped_from_name
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
              [
                id,
                item.product_id || item.menu_item_id || null,
                item.menu_item_id || item.product_id || null,
                item.name,
                item.price || 0,
                item.quantity || 1,
                item.packed_quantity || 0,
                item.variant_id || null,
                item.variant_name || null,
                JSON.stringify(item.addon_ids || []),
                JSON.stringify(item.addon_names || []),
                item.image_url || null,
                !!item.unavailable,
                !!item.replacement_pending,
                JSON.stringify(item.replacement_options || []),
                item.swapped_from_name || null,
              ]
            );
          }
        }
        const items = await loadOrderItems(id);
        return orderToApi({ ...r.rows[0], items_json: items });
      }

      if (collectionName === 'MenuItem' || collectionName === 'Product') {
        const fields = [];
        const vals = [];
        let i = 1;
        const map = {
          name: 'name',
          description: 'description',
          price: 'price',
          category: 'category_name',
          image_url: 'image_url',
          is_popular: 'is_popular',
          is_available: 'is_available',
        };
        for (const [k, col] of Object.entries(map)) {
          if (data[k] !== undefined) {
            fields.push(`${col} = $${i++}`);
            vals.push(data[k]);
          }
        }
        fields.push('updated_at = NOW()');
        vals.push(id);
        const r = await query(
          `UPDATE products SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
          vals
        );
        if (!r.rows[0]) throw new Error(`Item ${id} not found`);
        if (data.images != null || data.variants != null || data.addons != null) {
          await saveProductExtras(id, data);
        }
        return await enrichProductItem(productToMenuItem(r.rows[0]));
      }

      if (collectionName === 'Notification') {
        const r = await query(
          `UPDATE notifications SET is_read = COALESCE($1, is_read), title = COALESCE($2, title), body = COALESCE($3, body)
           WHERE id = $4 RETURNING *`,
          [data.is_read ?? null, data.title ?? null, data.body ?? null, id]
        );
        if (!r.rows[0]) throw new Error('Not found');
        notifyListeners('Notification');
        return rowToGeneric(r.rows[0]);
      }

      if (collectionName === 'AdminPromotion') {
        const r = await query(
          `UPDATE admin_promotions SET
            title = COALESCE($1, title),
            is_active = COALESCE($2, is_active),
            discount_value = COALESCE($3, discount_value),
            coupon_code = COALESCE($4, coupon_code)
           WHERE id = $5 RETURNING *`,
          [data.title ?? null, data.is_active ?? null, data.discount_value ?? null, data.coupon_code ?? null, id]
        );
        if (!r.rows[0]) throw new Error('Not found');
        return rowToGeneric(r.rows[0]);
      }

      if (collectionName === 'Wallet') {
        const r = await query(
          `UPDATE wallets SET balance = COALESCE($1, balance), updated_at = NOW() WHERE id = $2 RETURNING *`,
          [data.balance ?? null, id]
        );
        if (!r.rows[0]) throw new Error('Not found');
        return rowToGeneric(r.rows[0]);
      }

      throw new Error(`Update not implemented for ${collectionName} on PostgreSQL`);
    },

    delete: async (id) => {
      if (!meta) throw new Error(`Unknown collection ${collectionName}`);
      if (collectionName === 'Order') {
        await query(`DELETE FROM order_items WHERE order_id = $1`, [id]);
      }
      await query(`DELETE FROM ${meta.table} WHERE id = $1`, [id]);
      return { id };
    },
  };
}

export function hasPgEntity(collectionName) {
  return !!TABLE_MAP[collectionName];
}
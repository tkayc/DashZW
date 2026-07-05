/**
 * AddressService — CRUD for customer delivery addresses (PART 2).
 */
import { query, isPostgresEnabled } from '../../db/pg.js';
import { getMeta, setMeta } from '../../db/store.js';
import { geocodeAddress } from './geocodingService.js';

function generateId(prefix = 'addr') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function rowToAddress(row) {
  if (!row) return null;
  return {
    id: row.id,
    address_name: row.label,
    label: row.label,
    street_address: row.line1,
    line1: row.line1,
    line2: row.line2 || '',
    suburb: row.suburb || '',
    city: row.city || '',
    province: row.province || '',
    country: row.country || 'South Africa',
    postal_code: row.postal_code || '',
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    delivery_instructions: row.instructions || '',
    instructions: row.instructions || '',
    building_name: row.building_name || '',
    apartment_number: row.apartment_number || '',
    floor: row.floor || '',
    is_default: !!row.is_default,
    phone_number: row.phone || '',
    phone: row.phone || '',
    recipient_name: row.recipient_name || '',
    formatted_address: formatAddress(row),
    created_date: row.created_at,
    updated_date: row.updated_at,
  };
}

export function formatAddress(row) {
  const parts = [
    row.line1,
    row.line2,
    row.building_name,
    row.apartment_number ? `Apt ${row.apartment_number}` : null,
    row.floor ? `Floor ${row.floor}` : null,
    row.suburb,
    row.city,
    row.province,
    row.postal_code,
    row.country,
  ].filter(Boolean);
  return parts.join(', ');
}

async function resolveUserId(userEmail) {
  if (!isPostgresEnabled()) return userEmail;
  const r = await query('SELECT id FROM users WHERE email = $1', [userEmail]);
  return r.rows[0]?.id || null;
}

function jsonStoreKey(userEmail) {
  return `user_addresses_${userEmail.toLowerCase()}`;
}

async function listFromJson(userEmail) {
  return getMeta(jsonStoreKey(userEmail)) || [];
}

async function saveToJson(userEmail, addresses) {
  setMeta(jsonStoreKey(userEmail), addresses);
}

export async function listAddresses(userEmail) {
  if (!isPostgresEnabled()) {
    return (await listFromJson(userEmail)).map((a) => ({ ...a, formatted_address: formatAddress(a) }));
  }
  const userId = await resolveUserId(userEmail);
  if (!userId) return [];
  const r = await query(
    'SELECT * FROM user_addresses WHERE user_id = $1 ORDER BY is_default DESC, updated_at DESC',
    [userId]
  );
  return r.rows.map(rowToAddress);
}

export async function getDefaultAddress(userEmail) {
  const all = await listAddresses(userEmail);
  return all.find((a) => a.is_default) || all[0] || null;
}

export async function getAddress(userEmail, addressId) {
  const all = await listAddresses(userEmail);
  return all.find((a) => a.id === addressId) || null;
}

async function ensureCoords(data) {
  if (data.lat != null && data.lng != null) return data;
  const search = [data.street_address || data.line1, data.suburb, data.city, data.country]
    .filter(Boolean)
    .join(', ');
  if (!search.trim()) return data;
  const geo = await geocodeAddress(search, { city: data.city, country: data.country });
  if (!geo) return data;
  return {
    ...data,
    lat: geo.lat,
    lng: geo.lng,
    suburb: data.suburb || geo.suburb,
    city: data.city || geo.city,
    province: data.province || geo.province,
    country: data.country || geo.country,
    postal_code: data.postal_code || geo.postal_code,
  };
}

function normalizeInput(data) {
  return {
    label: data.address_name || data.label || 'Home',
    line1: data.street_address || data.line1 || '',
    line2: data.line2 || '',
    suburb: data.suburb || '',
    city: data.city || '',
    province: data.province || '',
    country: data.country || 'South Africa',
    postal_code: data.postal_code || '',
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    instructions: data.delivery_instructions || data.instructions || '',
    building_name: data.building_name || '',
    apartment_number: data.apartment_number || '',
    floor: data.floor || '',
    phone: data.phone_number || data.phone || '',
    recipient_name: data.recipient_name || '',
    is_default: !!data.is_default,
  };
}

export async function createAddress(userEmail, data) {
  const payload = await ensureCoords(normalizeInput(data));
  if (!payload.line1) throw new Error('Street address is required');

  if (!isPostgresEnabled()) {
    const list = await listFromJson(userEmail);
    const id = generateId('addr');
    if (payload.is_default) list.forEach((a) => { a.is_default = false; });
    const row = { id, ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    list.unshift(row);
    await saveToJson(userEmail, list);
    return rowToAddress(row);
  }

  const userId = await resolveUserId(userEmail);
  if (!userId) throw new Error('User not found');

  const id = generateId('addr');
  if (payload.is_default) {
    await query('UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1', [userId]);
  }

  const r = await query(
    `INSERT INTO user_addresses (
      id, user_id, label, line1, line2, suburb, city, province, country, postal_code,
      lat, lng, instructions, building_name, apartment_number, floor, phone, recipient_name, is_default
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    RETURNING *`,
    [
      id, userId, payload.label, payload.line1, payload.line2 || null, payload.suburb || null,
      payload.city || null, payload.province || null, payload.country, payload.postal_code || null,
      payload.lat, payload.lng, payload.instructions || null, payload.building_name || null,
      payload.apartment_number || null, payload.floor || null, payload.phone || null,
      payload.recipient_name || null, payload.is_default,
    ]
  );
  return rowToAddress(r.rows[0]);
}

export async function updateAddress(userEmail, addressId, data) {
  const existing = await getAddress(userEmail, addressId);
  if (!existing) throw new Error('Address not found');

  const merged = await ensureCoords(normalizeInput({ ...existing, ...data }));
  if (!merged.line1) throw new Error('Street address is required');

  if (!isPostgresEnabled()) {
    const list = await listFromJson(userEmail);
    const idx = list.findIndex((a) => a.id === addressId);
    if (idx < 0) throw new Error('Address not found');
    if (merged.is_default) list.forEach((a) => { a.is_default = false; });
    list[idx] = { ...list[idx], ...merged, updated_at: new Date().toISOString() };
    await saveToJson(userEmail, list);
    return rowToAddress(list[idx]);
  }

  const userId = await resolveUserId(userEmail);
  if (merged.is_default) {
    await query('UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1', [userId]);
  }

  const r = await query(
    `UPDATE user_addresses SET
      label = $1, line1 = $2, line2 = $3, suburb = $4, city = $5, province = $6, country = $7,
      postal_code = $8, lat = $9, lng = $10, instructions = $11, building_name = $12,
      apartment_number = $13, floor = $14, phone = $15, recipient_name = $16, is_default = $17,
      updated_at = NOW()
    WHERE id = $18 AND user_id = $19 RETURNING *`,
    [
      merged.label, merged.line1, merged.line2 || null, merged.suburb || null, merged.city || null,
      merged.province || null, merged.country, merged.postal_code || null, merged.lat, merged.lng,
      merged.instructions || null, merged.building_name || null, merged.apartment_number || null,
      merged.floor || null, merged.phone || null, merged.recipient_name || null, merged.is_default,
      addressId, userId,
    ]
  );
  if (!r.rows[0]) throw new Error('Address not found');
  return rowToAddress(r.rows[0]);
}

export async function deleteAddress(userEmail, addressId) {
  if (!isPostgresEnabled()) {
    const list = (await listFromJson(userEmail)).filter((a) => a.id !== addressId);
    await saveToJson(userEmail, list);
    return { id: addressId };
  }
  const userId = await resolveUserId(userEmail);
  await query('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2', [addressId, userId]);
  return { id: addressId };
}

export async function setDefaultAddress(userEmail, addressId) {
  return updateAddress(userEmail, addressId, { is_default: true });
}

export async function saveCurrentLocationAsAddress(userEmail, { lat, lng, address_name = 'Current Location', ...rest }) {
  const geo = await reverseGeocodeFromCoords(lat, lng);
  return createAddress(userEmail, {
    address_name,
    street_address: geo?.street_address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    suburb: geo?.suburb,
    city: geo?.city,
    province: geo?.province,
    country: geo?.country,
    postal_code: geo?.postal_code,
    lat,
    lng,
    is_default: true,
    ...rest,
  });
}

async function reverseGeocodeFromCoords(lat, lng) {
  const { reverseGeocode } = await import('./geocodingService.js');
  return reverseGeocode(lat, lng);
}

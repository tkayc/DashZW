/**
 * Platform users (customer, partner, driver, admin).
 * Uses PostgreSQL when DATABASE_URL is set; otherwise JSON files.
 */
import { getUsersFile, saveUsersFile } from '../../db/store.js';
import { isPostgresEnabled, query } from '../../db/pg.js';
import { MERCHANT_STAFF_ROLES, defaultStaffRoleForPartnerUser } from '../../domain/merchantStaffRoles.js';

export const DEMO_USERS = [
  { email: 'customer@demo.com', full_name: 'Alex Customer', role: 'customer', password: 'demo' },
  { email: 'mamas@dashzw.com', full_name: "Mama's Kitchen", role: 'partner', staff_role: MERCHANT_STAFF_ROLES.OWNER, password: 'partner123' },
  { email: 'zimburger@dashzw.com', full_name: 'Zim Burger Co', role: 'partner', staff_role: MERCHANT_STAFF_ROLES.OWNER, password: 'partner123' },
  { email: 'sunrise@dashzw.com', full_name: 'Sunrise Bakery', role: 'partner', staff_role: MERCHANT_STAFF_ROLES.OWNER, password: 'partner123' },
  { email: 'chillsip@dashzw.com', full_name: 'Chill & Sip', role: 'partner', staff_role: MERCHANT_STAFF_ROLES.OWNER, password: 'partner123' },
  { email: 'sweettooth@dashzw.com', full_name: 'Sweet Tooth', role: 'partner', staff_role: MERCHANT_STAFF_ROLES.OWNER, password: 'partner123' },
  { email: 'freshmart@dashzw.com', full_name: 'FreshMart', role: 'partner', staff_role: MERCHANT_STAFF_ROLES.OWNER, password: 'partner123' },
  { email: 'careplus@dashzw.com', full_name: 'CarePlus Pharmacy', role: 'partner', staff_role: MERCHANT_STAFF_ROLES.OWNER, password: 'partner123' },
  { email: 'quickstop@dashzw.com', full_name: 'QuickStop Convenience', role: 'partner', staff_role: MERCHANT_STAFF_ROLES.OWNER, password: 'partner123' },
  { email: 'driver1@dashzw.com', full_name: 'Tendai Moyo', role: 'driver', password: 'driver123' },
  { email: 'driver2@dashzw.com', full_name: 'Chido Ncube', role: 'driver', password: 'driver123' },
  { email: 'driver3@dashzw.com', full_name: 'Farai Dube', role: 'driver', password: 'driver123' },
  { email: 'admin@dashzw.com', full_name: 'DashZW Admin', role: 'admin', password: 'admin123' },
];

function makeId(email) {
  return 'usr_' + email.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 10) + '_' + Date.now().toString(36).slice(-4);
}

function mapPgUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    staff_role: row.staff_role || undefined,
    phone: row.phone || '',
    created_date: row.created_at,
  };
}

// ── JSON fallback (no DATABASE_URL) ─────────────────────────────────────────

export function ensureDemoUsers() {
  if (isPostgresEnabled()) return []; // already seeded in SQL
  let users = getUsersFile();
  if (!users.length) {
    users = DEMO_USERS.map((u) => ({
      ...u,
      id: makeId(u.email),
      created_date: new Date().toISOString(),
    }));
    saveUsersFile(users);
    return users;
  }
  let changed = false;
  for (const demo of DEMO_USERS) {
    if (!users.some((u) => u.email.toLowerCase() === demo.email.toLowerCase())) {
      users.push({ ...demo, id: makeId(demo.email), created_date: new Date().toISOString() });
      changed = true;
    }
  }
  if (changed) saveUsersFile(users);
  return users;
}

function getUsersStoreJson() {
  const users = getUsersFile();
  if (!users.length) return ensureDemoUsers();
  return users;
}

export function sanitizeUser(user) {
  if (!user) return user;
  const { password: _p, password_hash: _h, ...safe } = user;
  return safe;
}

// ── Public API (async — works with Postgres or JSON) ────────────────────────

export async function authenticateUser(email, password) {
  if (!email || !password) return null;

  if (isPostgresEnabled()) {
    const r = await query(
      `SELECT id, email, full_name, role, staff_role, phone, created_at
       FROM users
       WHERE email = $1
         AND is_active = TRUE
         AND password_hash = crypt($2, password_hash)`,
      [email.toLowerCase().trim(), password]
    );
    return mapPgUser(r.rows[0]);
  }

  ensureDemoUsers();
  const user = getUsersStoreJson().find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.password !== password) return null;
  return sanitizeUser(user);
}

export async function findUserByEmail(email) {
  if (!email) return null;
  if (isPostgresEnabled()) {
    const r = await query(
      `SELECT id, email, full_name, role, staff_role, phone, created_at
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
    return mapPgUser(r.rows[0]);
  }
  return getUsersStoreJson().find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

export async function registerUser({ email, password, full_name, role, phone }) {
  const em = email.toLowerCase().trim();

  if (isPostgresEnabled()) {
    const existing = await query('SELECT id FROM users WHERE email = $1', [em]);
    if (existing.rows.length) throw new Error('An account with this email already exists');

    const staffRole = role === 'partner' ? defaultStaffRoleForPartnerUser() : null;
    const r = await query(
      `INSERT INTO users (email, password_hash, full_name, role, staff_role, phone, email_verified)
       VALUES ($1, crypt($2, gen_salt('bf')), $3, $4, $5, $6, FALSE)
       RETURNING id, email, full_name, role, staff_role, phone, created_at`,
      [em, password, full_name.trim(), role || 'customer', staffRole, phone || null]
    );
    return mapPgUser(r.rows[0]);
  }

  const users = getUsersStoreJson();
  if (users.find((u) => u.email.toLowerCase() === em)) {
    throw new Error('An account with this email already exists');
  }
  const newUser = {
    id: makeId(em),
    email: em,
    password,
    full_name: full_name.trim(),
    role,
    phone: phone || '',
    staff_role: role === 'partner' ? defaultStaffRoleForPartnerUser() : undefined,
    approval_status: role === 'partner' ? 'pending' : 'approved',
    created_date: new Date().toISOString(),
  };
  users.push(newUser);
  saveUsersFile(users);
  return sanitizeUser(newUser);
}

export async function updateUser(email, data) {
  if (isPostgresEnabled()) {
    const allowed = ['full_name', 'phone', 'role', 'is_active'];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(`${key} = $${i++}`);
        vals.push(data[key]);
      }
    }
    if (!sets.length) return findUserByEmail(email);
    sets.push('updated_at = NOW()');
    vals.push(email.toLowerCase().trim());
    const r = await query(
      `UPDATE users SET ${sets.join(', ')} WHERE email = $${i}
       RETURNING id, email, full_name, role, staff_role, phone, created_at`,
      vals
    );
    if (!r.rows[0]) throw new Error('User not found');
    return mapPgUser(r.rows[0]);
  }

  const users = getUsersStoreJson();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (idx < 0) throw new Error('User not found');
  users[idx] = { ...users[idx], ...data, updated_date: new Date().toISOString() };
  saveUsersFile(users);
  return sanitizeUser(users[idx]);
}

export async function listUsersSafe() {
  if (isPostgresEnabled()) {
    const r = await query(
      `SELECT id, email, full_name, role, staff_role, phone, created_at
       FROM users ORDER BY created_at`
    );
    return r.rows.map(mapPgUser);
  }
  return getUsersStoreJson().map(sanitizeUser);
}

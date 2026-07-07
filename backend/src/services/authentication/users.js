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

export function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function accountExistsError(field, message, existingEmail) {
  const err = new Error(message);
  err.code = 'ACCOUNT_EXISTS';
  err.field = field;
  err.existingEmail = existingEmail;
  return err;
}

function mapPgUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: String(row.email || ''),
    full_name: row.full_name,
    role: row.role,
    staff_role: row.staff_role || undefined,
    phone: row.phone || '',
    is_active: row.is_active !== false,
    created_date: row.created_at,
  };
}

const DEMO_USER_IDS = {
  'customer@demo.com': 'usr_customer_demo',
  'mamas@dashzw.com': 'usr_mamas',
  'zimburger@dashzw.com': 'usr_zimburger',
  'sunrise@dashzw.com': 'usr_sunrise',
  'chillsip@dashzw.com': 'usr_chillsip',
  'sweettooth@dashzw.com': 'usr_sweettooth',
  'freshmart@dashzw.com': 'usr_freshmart',
  'careplus@dashzw.com': 'usr_careplus',
  'quickstop@dashzw.com': 'usr_quickstop',
  'driver1@dashzw.com': 'usr_driver1',
  'driver2@dashzw.com': 'usr_driver2',
  'driver3@dashzw.com': 'usr_driver3',
  'admin@dashzw.com': 'usr_admin',
};

async function ensurePostgresDemoUsers() {
  for (const demo of DEMO_USERS) {
    const email = demo.email.toLowerCase();
    const id = DEMO_USER_IDS[email] || makeId(email);
    await query(
      `INSERT INTO users (id, email, password_hash, full_name, role, staff_role, email_verified, is_active)
       VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, $5, $6, TRUE, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = crypt($3, gen_salt('bf')),
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         staff_role = COALESCE(EXCLUDED.staff_role, users.staff_role),
         is_active = TRUE`,
      [id, email, demo.password, demo.full_name, demo.role, demo.staff_role || null]
    );
  }
}

// ── JSON fallback (no DATABASE_URL) ─────────────────────────────────────────

export async function ensureDemoUsers() {
  if (isPostgresEnabled()) {
    await ensurePostgresDemoUsers();
    return [];
  }
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

export async function findUserByPhone(phone) {
  const digits = normalizePhone(phone);
  if (!digits || digits.length < 9) return null;

  if (isPostgresEnabled()) {
    const r = await query(
      `SELECT id, email, full_name, role, staff_role, phone, created_at
       FROM users
       WHERE regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $1
       LIMIT 1`,
      [digits]
    );
    return mapPgUser(r.rows[0]);
  }

  return (
    getUsersStoreJson().find((u) => normalizePhone(u.phone) === digits) || null
  );
}

export async function checkAccountAvailability({ email, phone }) {
  const em = email?.toLowerCase().trim();
  if (em) {
    const byEmail = await findUserByEmail(em);
    if (byEmail) {
      return {
        available: false,
        field: 'email',
        message: 'An account with this email already exists.',
        existingEmail: byEmail.email,
      };
    }
  }

  const digits = normalizePhone(phone);
  if (digits.length >= 9) {
    const byPhone = await findUserByPhone(digits);
    if (byPhone) {
      return {
        available: false,
        field: 'phone',
        message: 'An account with this phone number already exists.',
        existingEmail: byPhone.email,
      };
    }
  }

  return { available: true };
}

// Roles a user may self-assign during public registration. Privileged roles
// (admin / super_admin) must never be grantable from the register endpoint.
const SELF_REGISTRABLE_ROLES = new Set(['customer', 'partner', 'driver']);

export async function registerUser({ email, password, full_name, role, phone }) {
  const em = email.toLowerCase().trim();
  const resolvedRole = SELF_REGISTRABLE_ROLES.has(role) ? role : 'customer';

  const existingEmail = await findUserByEmail(em);
  if (existingEmail) {
    throw accountExistsError(
      'email',
      'An account with this email already exists. Sign in or reset your password.',
      existingEmail.email
    );
  }

  const phoneDigits = normalizePhone(phone);
  if (phoneDigits.length >= 9) {
    const existingPhone = await findUserByPhone(phone);
    if (existingPhone) {
      throw accountExistsError(
        'phone',
        'An account with this phone number already exists. Sign in or reset your password.',
        existingPhone.email
      );
    }
  }

  if (isPostgresEnabled()) {
    const staffRole = resolvedRole === 'partner' ? defaultStaffRoleForPartnerUser() : null;
    const r = await query(
      `INSERT INTO users (email, password_hash, full_name, role, staff_role, phone, email_verified)
       VALUES ($1, crypt($2, gen_salt('bf')), $3, $4, $5, $6, FALSE)
       RETURNING id, email, full_name, role, staff_role, phone, created_at`,
      [em, password, full_name.trim(), resolvedRole, staffRole, phone || null]
    );
    return mapPgUser(r.rows[0]);
  }

  const users = getUsersStoreJson();
  const newUser = {
    id: makeId(em),
    email: em,
    password,
    full_name: full_name.trim(),
    role: resolvedRole,
    phone: phone || '',
    staff_role: resolvedRole === 'partner' ? defaultStaffRoleForPartnerUser() : undefined,
    approval_status: resolvedRole === 'partner' ? 'pending' : 'approved',
    created_date: new Date().toISOString(),
  };
  users.push(newUser);
  saveUsersFile(users);
  return sanitizeUser(newUser);
}

export async function resetPassword(email, newPassword) {
  const em = email?.toLowerCase().trim();
  if (!em || !newPassword || newPassword.length < 6) {
    throw new Error('Valid email and password (min 6 characters) are required');
  }

  if (isPostgresEnabled()) {
    const r = await query(
      `UPDATE users
       SET password_hash = crypt($2, gen_salt('bf')), updated_at = NOW()
       WHERE email = $1 AND is_active = TRUE
       RETURNING email`,
      [em, newPassword]
    );
    if (!r.rows[0]) throw new Error('No account found for this email');
    return { ok: true, email: r.rows[0].email };
  }

  const users = getUsersStoreJson();
  const idx = users.findIndex((u) => u.email.toLowerCase() === em);
  if (idx < 0) throw new Error('No account found for this email');
  users[idx].password = newPassword;
  saveUsersFile(users);
  return { ok: true, email: users[idx].email };
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
      `SELECT id, email, full_name, role, staff_role, phone, is_active, created_at
       FROM users ORDER BY created_at`
    );
    return r.rows.map(mapPgUser).filter(Boolean);
  }
  return getUsersStoreJson().map(sanitizeUser);
}

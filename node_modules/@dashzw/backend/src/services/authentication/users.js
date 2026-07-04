/**
 * Platform users (customer, partner, driver, admin).
 * Partner accounts map to merchant staff (default role: Owner).
 *
 * TODO(postgresql): users + merchant_staff tables with FK relationships.
 */
import { getUsersFile, saveUsersFile } from '../../db/store.js';
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

export function ensureDemoUsers() {
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
  // Merge any new demo accounts (e.g. new merchant categories) without wiping data
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

export function getUsersStore() {
  const users = getUsersFile();
  if (!users.length) return ensureDemoUsers();
  return users;
}

export function findUserByEmail(email) {
  return getUsersStore().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function sanitizeUser(user) {
  const { password: _, ...safe } = user;
  return safe;
}

export function registerUser({ email, password, full_name, role, phone }) {
  const users = getUsersStore();
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists');
  }
  const newUser = {
    id: makeId(email),
    email: email.toLowerCase().trim(),
    password,
    full_name: full_name.trim(),
    role,
    phone: phone || '',
    // Partner platform role ⇒ merchant staff (Owner by default)
    staff_role: role === 'partner' ? defaultStaffRoleForPartnerUser() : undefined,
    approval_status: role === 'partner' ? 'pending' : 'approved',
    created_date: new Date().toISOString(),
  };
  users.push(newUser);
  saveUsersFile(users);
  return sanitizeUser(newUser);
}

export function updateUser(email, data) {
  const users = getUsersStore();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.toLowerCase());
  if (idx < 0) throw new Error('User not found');
  users[idx] = { ...users[idx], ...data, updated_date: new Date().toISOString() };
  saveUsersFile(users);
  return sanitizeUser(users[idx]);
}

export function listUsersSafe() {
  return getUsersStore().map(sanitizeUser);
}

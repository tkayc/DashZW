/**
 * Manual verification notes for entity authorization + wallet rules.
 *
 * Run API with: npm run dev:api
 * Then use curl (replace TOKEN_CUSTOMER / TOKEN_PARTNER after login).
 *
 * Expected results:
 * 1. Customer cannot list another customer's orders (only own rows returned)
 * 2. Customer cannot PATCH Wallet balance
 * 3. Customer cannot invoke finance.debitWallet / finance.creditWallet
 * 4. Partner cannot read another partner's Shop
 * 5. /api/entities/Order/raw returns 404
 */

const API = process.env.API_URL || 'http://localhost:3001';

async function login(email, password) {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || 'login failed');
  return data.token;
}

async function api(token, path, options = {}) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function main() {
  console.log('Logging in…');
  const customerToken = await login('customer@demo.com', 'demo');
  const partnerToken = await login('mamas@dashzw.com', 'partner123');

  // 1) Raw routes gone
  const raw = await api(customerToken, '/api/entities/Order/raw');
  console.log('GET /Order/raw →', raw.status, '(expect 404)');

  // 2) Customer wallet write blocked
  const wallets = await api(customerToken, '/api/entities/Wallet/list');
  const myWallet = (wallets.data || [])[0];
  if (myWallet) {
    const patch = await api(customerToken, `/api/entities/Wallet/${myWallet.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ balance: 99999 }),
    });
    console.log('Customer PATCH Wallet →', patch.status, patch.data.message || '', '(expect 403)');
  } else {
    console.log('Customer Wallet list →', wallets.status, 'rows', (wallets.data || []).length);
  }

  // 3) Customer debitWallet invoke blocked
  const debit = await api(customerToken, '/api/domain/invoke', {
    method: 'POST',
    body: JSON.stringify({
      module: 'finance',
      method: 'debitWallet',
      args: ['customer@demo.com', 'customer', 1, 'hack'],
    }),
  });
  console.log('Customer debitWallet invoke →', debit.status, debit.data.message || '', '(expect 403)');

  // 4) Customer Settlement list empty/forbidden
  const settle = await api(customerToken, '/api/entities/Settlement/list');
  console.log('Customer Settlement list →', settle.status, 'rows', (settle.data || []).length, '(expect 0 rows)');

  // 5) Partner only sees own shops
  const shops = await api(partnerToken, '/api/entities/Shop/list');
  const emails = (shops.data || []).map((s) => s.owner_email);
  const onlyOwn = emails.every((e) => e === 'mamas@dashzw.com');
  console.log('Partner Shop list owners →', emails, onlyOwn ? 'OK own-only' : 'FAIL leaked shops');

  console.log('\nDone. Review lines above for expected 403/404/own-only.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

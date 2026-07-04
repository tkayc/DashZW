# What to do after the SQL script succeeds

You already created the database. Do these steps **in order**.

---

## Step 1 — Create the env file

1. Open the folder: `DashZW/backend/`
2. Copy `.env.example` and rename the copy to `.env`
3. Open `.env` and put **your real Postgres password** in place of `YOUR_PASSWORD`:

```env
PORT=3001
API_VERSION=v1
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/dashzw
```

Example: if your password is `mypass123`:

```env
DATABASE_URL=postgresql://postgres:mypass123@localhost:5432/dashzw
```

If your Postgres username is not `postgres`, change that part too.

Save the file.

---

## Step 2 — Start the app

In a terminal, from the **DashZW** project root:

```bash
npm run dev
```

Or only the API:

```bash
npm run dev:api
```

---

## Step 3 — Confirm Postgres is connected

Open this in your browser:

http://localhost:3001/api/health

You want to see something like:

```json
"postgres": { "enabled": true, "ok": true, "message": "connected", "users": 13 }
```

- **`ok: true`** → login uses your Postgres users table. Done.
- **`ok: false`** → wrong password or Postgres not running. Fix `DATABASE_URL` and restart.
- **`enabled: false`** → `.env` is missing or not loaded. Recheck Step 1 (file must be named `.env` inside `backend/`).

In the terminal you should also see:

`[DashZW API] PostgreSQL: connected (13 users)`

---

## Step 4 — Log in

Use any demo account from the SQL seed:

| App | URL | Email | Password |
|-----|-----|-------|----------|
| Customer | http://localhost:5173 | `customer@demo.com` | `demo` |
| Partner | http://localhost:5174 | `mamas@dashzw.com` | `partner123` |
| Driver | http://localhost:5175 | `driver1@dashzw.com` | `driver123` |
| Admin | http://localhost:5176 | `admin@dashzw.com` | `admin123` |

If login works, **auth is reading from Postgres**.

---

## What still uses JSON files (for now)

Orders, merchants, products, wallets, notifications, etc. still use `backend/data/*.json` until those modules are migrated.

**Login / register / user list** use Postgres when `DATABASE_URL` is set.

That is expected and enough to confirm the database is wired.

---

## If something fails

| Problem | Fix |
|---------|-----|
| Health shows `enabled: false` | Create `backend/.env` (not only `.env.example`) |
| Health shows `ok: false` / password error | Fix password in `DATABASE_URL`, restart API |
| Connection refused | Start PostgreSQL service in Windows |
| Login fails | Confirm users exist: `SELECT email FROM users;` in pgAdmin |

# DashZW

Only two project folders: **`backend/`** and **`frontends/`**.

```
DashZW/
├── backend/                          # Backend API
│   └── src/
│       ├── services/
│       │   ├── authentication/
│       │   ├── orders/
│       │   ├── payments/
│       │   ├── driver/
│       │   ├── restaurant/
│       │   ├── notifications/
│       │   └── admin/
│       ├── db/
│       ├── routes/
│       └── index.js
│
└── frontends/
    ├── customer/                     # Customer app (self-contained)
    │   └── src/
    │       ├── api/                  # API client
    │       ├── components/           # UI + app components
    │       ├── pages/
    │       ├── hooks/
    │       ├── lib/
    │       └── styles/
    ├── partner/                      # Partner shop app (self-contained)
    ├── driver/                       # Driver app (self-contained)
    └── admin/                        # Admin web dashboard (self-contained)
```

Root `package.json` only orchestrates workspaces (`npm run dev`).

## Run

```bash
npm install
npm run dev
```

| App | URL | Demo login |
|-----|-----|------------|
| Customer | http://localhost:5173 | customer@demo.com / demo |
| Partner | http://localhost:5174 | mamas@dashzw.com / partner123 |
| Driver | http://localhost:5175 | driver1@dashzw.com / driver123 |
| Admin | http://localhost:5176 | admin@dashzw.com / admin123 |

API: http://localhost:3001

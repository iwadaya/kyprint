# PrintShop Pro

Dark-theme management app for a South African print shop. React (Vite) frontend, Node/Express API, PostgreSQL.

Design system: **Syne** (brand/headings), **IBM Plex Sans** (UI/body), **IBM Plex Mono** (all numeric data, IDs, dates, badges). Cyan `#00d4aa` brand accent on a `#0f0f0d` charcoal base. All amounts in ZAR (`R 3,200.00`).

---

## Stack

```
db/        PostgreSQL — 8 numbered migrations + seed.sql
server/    Express + node-postgres API (JWT auth, permission + financial gating)
client/    React + Vite SPA (react-router)
```

## Quick start

You need Node 18+ and PostgreSQL 14+ (or Docker).

```bash
# 1. Database (Docker — or point DATABASE_URL at your own Postgres)
docker compose up -d db

# 2. Schema + demo data
psql --version                      # needs the psql client on PATH
DATABASE_URL=postgres://printshop:printshop@localhost:5432/printshop ./db/run.sh

# 3. API
cd server && cp .env.example .env && npm install && npm start    # → http://localhost:4000

# 4. Frontend (new terminal)
cd client && npm install && npm run dev                          # → http://localhost:5173
```

Open http://localhost:5173.

### Demo logins (password `printshop2026` for all)
| Role | Email | Notes |
|------|-------|-------|
| Owner | `thandiwe@printshoppro.co.za` | all 16 permissions, sees Access Control + all amounts |
| Front-of-house | `sipho@printshoppro.co.za` | **no `finance.view`** — amounts show `—` |
| Production | `lerato@printshoppro.co.za` | ops permissions |
| Design | `pieter@printshoppro.co.za` | has `finance.view` |

Log in as Sipho to see the financial gating; log in as the owner, open **Access Control**, grant Sipho *View Financials*, and his amounts appear.

---

## Deploy on Render

The repo ships a [`render.yaml`](./render.yaml) Blueprint that provisions **one web service + a managed PostgreSQL database**. The web service builds the React client and the Express API together; the API serves the built SPA from `client/dist`, so the client's relative `/api` calls work on a single origin with no CORS or base-URL configuration. On boot the server applies every SQL migration and loads the demo seed automatically (idempotent — safe on every redeploy), so the first deploy comes up ready to log in.

**One-click-ish:**

1. Push this repo to GitHub.
2. In Render → **New + → Blueprint**, select the repo, and **Apply**. Render reads `render.yaml`, creates the `printshop-db` Postgres and the `printshop-pro` web service, generates `JWT_SECRET`, and wires `DATABASE_URL` to the database.
3. Wait for the build/deploy to finish, open the service URL, and log in with `thandiwe@printshoppro.co.za` / `printshop2026`.

**What runs where**

| | Command | Notes |
|---|---|---|
| Build | `npm install --prefix server && npm install --prefix client --include=dev && npm run build --prefix client` | `--include=dev` keeps Vite available under `NODE_ENV=production` |
| Start | `npm start --prefix server` | applies migrations + seed on boot, then listens |
| Health check | `GET /api/health` | |

**Environment variables** (set automatically by the Blueprint):

| Var | Source | Purpose |
|-----|--------|---------|
| `DATABASE_URL` | from `printshop-db` | Postgres connection (SSL auto-enabled for Render hosts) |
| `JWT_SECRET` | generated | token signing |
| `NODE_ENV` | `production` | |
| `NODE_VERSION` | `20` | |
| `AUTO_MIGRATE` | _(unset → on)_ | set to `false` to manage the schema yourself (e.g. `npm run migrate` as a pre-deploy step) |

> Free Postgres and free web services are fine for a demo (the web service sleeps when idle and cold-starts on the next request). For anything real, bump both to a paid plan in `render.yaml`.

---

## How the permission / financial gate works

The 16 permissions live in the `permissions` table; each user's grants are rows in `user_permissions`. The Access Control matrix edits these directly (owner is locked at all 16).

**Financial values are stripped on the server, never the client.** Any API row containing money passes through `redactMoney()` in `server/src/permissions.js`; without `finance.view` the monetary fields come back as `null`. The client's `rand()` formatter renders `null` as an em dash `—`. There is no amount hidden in the payload for a gated user to inspect.

## Customer model

`customers.type` is `individual | company`. First name + surname are always required; `company_name` is required only for companies (DB check constraint). VAT numbers are validated as `^4\d{9}$` (SA format) both in the API and as a check constraint. The create/edit form enforces the same rules client-side for fast feedback.

## Customer Portal

`/portal/:token` is a standalone full-page layout (cyan gradient header, order progress bars, proof approvals, invoice history). It is authenticated by the customer's `portal_token` in the URL — **no staff login required** — which is why it's mounted before the auth middleware. Each customer row has a "Portal" link that opens their token.

---

## What's complete vs. scaffolded

**Complete & verified against Postgres 16:**
- All 8 migrations, triggers (invoice balance recalc), the `overdue_invoices` and `customer_summary` views, and both customer check constraints.
- Auth (JWT + pgcrypto bcrypt), server-side permission guards and financial redaction.
- Customers: full create/edit with validation. Access Control: live 16-permission matrix save. Portal: live. Dashboard: owner + employee variants. Orders / Quotes / Invoices / Payments / Reminders / Proofing / Stock / Deliveries / WhatsApp: read views wired to the API with correct gating and badges.

**Scaffolded — sensible next steps (good Claude Code tasks):**
- Write-path modals for orders/quotes/invoices/payments/whatsapp exist server-side (POST routes) but the client currently exposes create UI only for customers; wire the remaining "+ New…" modals to their endpoints.
- Quote→order and order→invoice conversion flows.
- Real WhatsApp provider + a scheduler to auto-flip invoices to `overdue` and to send staged reminders (the `overdue_invoices` view already identifies them; an unpaid invoice only changes status on recalc — add a daily job).
- Replace the demo "Send" buttons on Reminders/WhatsApp with calls to the POST endpoints.
- Zod (or similar) request validation on all write endpoints; transaction-wrap the permission replace in `users.js`.
- Pagination/search on list endpoints; file storage for proofs.

## API surface (all under `/api`)

```
POST  /auth/login                  GET /auth/me
GET   /dashboard
GET   /customers   POST /customers   PUT /customers/:id
GET   /orders      POST /orders      PATCH /orders/:id/status
GET   /quotes      POST /quotes
GET   /invoices    POST /invoices
GET   /payments    POST /payments
GET   /reminders
GET   /proofs      PATCH /proofs/:id
GET   /stock   GET /deliveries   GET /whatsapp   POST /whatsapp
GET   /users   GET /users/permissions   PUT /users/:id/permissions   (users.manage)
GET   /portal/:token               (public, token-auth)
```

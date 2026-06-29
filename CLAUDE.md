# CLAUDE.md — Broker Execution vs Market Comparison Dashboard

## Commands

```bash
# Frontend (repo root)
npm install
npm run dev       # Vite dev server (proxies /api/internal, /auth, /admin to :8000)
npm run build     # tsc -b && vite build
npm run preview

# Backend
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env     # then fill in credentials/DB connection
uvicorn app.main:app --reload --port 8000
```

No test suite or linter is currently configured in either the frontend or
backend.

## Project Overview

React dashboard fetching order-execution data per broker and market-wide
aggregated trade info, rendering a comparison data table + Recharts chart.

Authentication and data fetching against the external broker API
(`https://uat.xfltrade.com:20121`) is handled entirely by a FastAPI + MySQL
backend (`/backend`). The backend authenticates with a service account on a
schedule, caches the latest broker/market data in MySQL, and serves it to the
frontend via internal endpoints. The frontend never talks to the external API
or handles the auto-credential pipeline's tokens directly.

Separately, the app has a **human-facing admin panel** (JWT-based login,
`admin`/`user` roles, broker + user management — see "Admin Panel: Auth &
User Management" below). This is a completely independent auth system from
the auto-credential pipeline above; it does not touch `token_store`,
`broker_snapshots`, `market_snapshots`, `pipeline_logs`, or
`config_data/brokers.py`.

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 18 + TypeScript               |
| Charts   | Recharts                            |
| Styling  | Tailwind CSS                        |
| HTTP     | Axios                               |
| Backend  | FastAPI + SQLAlchemy + MySQL + APScheduler |
| Config   | Hardcoded broker IDs, internal-endpoint data fetching |

---

## Directory Structure

```
src/
├── config/
│   ├── brokers.ts          # Static XBrokerId list (pipeline brokers, separate from admin `brokers` table)
│   └── api.ts              # Base URL, endpoint paths, thresholds
├── services/
│   ├── apiService.ts       # Calls to /api/internal/* (via httpClient)
│   ├── httpClient.ts        # Shared axios instance: attaches Bearer token, refreshes on 401
│   ├── tokenStorage.ts      # Persists { accessToken, refreshToken } in localStorage
│   ├── authService.ts       # login/logout/changePassword/fetchMe (/auth/*)
│   └── adminService.ts      # Admin CRUD for brokers/users (/admin/*)
├── hooks/
│   └── useDashboardData.ts # Fetches internal endpoints + computes aggregation
├── context/
│   └── AuthContext.tsx     # AuthProvider/useAuth — user, status, login/logout/refreshUser
├── components/
│   ├── ProtectedRoute.tsx  # Route guard (auth + optional role check)
│   ├── Login.tsx           # Real login form (email/password)
│   ├── Profile.tsx         # Self-service change-password page
│   ├── Dashboard.tsx       # Main dashboard layout (routed at /dashboard)
│   ├── FilterBar.tsx       # Date range + stock exchange inputs (display only)
│   ├── ComparisonTable.tsx # Data table: per-broker + aggregate vs market
│   ├── ComparisonChart.tsx # Recharts ComposedChart
│   └── admin/
│       ├── AdminLayout.tsx       # Admin shell: header + sidebar nav + <Outlet/>
│       ├── BrokerManagement.tsx  # CRUD UI for admin `brokers` table
│       └── UserManagement.tsx    # CRUD UI for `users` table (role/broker assignment)
├── types/
│   ├── index.ts            # Dashboard TS interfaces
│   └── auth.ts             # Admin-panel auth/user/broker TS interfaces
└── App.tsx                 # BrowserRouter + AuthProvider + route table

backend/
├── app/
│   ├── main.py              # FastAPI app, lifespan (DB init + seeding + scheduler), CORS, routers
│   ├── config.py            # Settings (.env), incl. JWT settings
│   ├── db/                  # SQLAlchemy engine/session
│   ├── models/              # token_store, broker_snapshots, market_snapshots, pipeline_logs,
│   │                         # + admin panel: user, broker, token_blacklist
│   ├── schemas/              # Pydantic models: internal endpoints + auth/user/admin_broker
│   ├── config_data/brokers.py  # BROKERS — seed/backfill source for the `brokers` table
│   │                             # (external_api_id, order_index), keep in sync with src/config/brokers.ts
│   ├── dependencies/auth.py # get_current_user, require_admin (JWT + blacklist checks)
│   ├── services/
│   │   ├── external_api.py  # httpx calls to external broker API
│   │   ├── auth_service.py  # auth()/refresh + token_store CRUD (pipeline service account)
│   │   ├── fetch_service.py # fetch_all(db, ...): pipeline-enabled brokers (from `brokers` table) + market
│   │   ├── store_service.py # upserts into snapshot tables + pipeline_logs
│   │   ├── pipeline.py      # run_pipeline(): orchestration
│   │   ├── password_service.py # bcrypt hash/verify (admin panel)
│   │   ├── jwt_service.py      # access/refresh token create + decode (admin panel)
│   │   ├── user_service.py     # admin `users` table CRUD + seed_default_admin
│   │   └── broker_service.py   # admin `brokers` table CRUD + seed_brokers (+ pipeline broker list)
│   ├── scheduler/jobs.py    # APScheduler: startup run + daily cron
│   └── routers/
│       ├── internal.py      # /api/internal/* endpoints (pipeline data, unauthenticated)
│       ├── auth.py          # /auth/* — login, refresh, logout, change-password, me
│       ├── admin_brokers.py # /admin/brokers/* — admin-only broker CRUD
│       └── admin_users.py   # /admin/users/* — admin-only user CRUD
└── requirements.txt
```

---

## Configuration

### `src/config/brokers.ts`

```ts
export interface Broker {
  id: string;    // value sent as X-BrokerId header
  label: string; // display name in table/chart
}

export const BROKERS: Broker[] = [
  { id: "cdhvcbbhhurtuu",      label: "SNM" },
  { id: "hgdchhhgjvvvvbbhhhb", label: "BAL" },
  // add more brokers here
];
```

### `src/config/api.ts`

```ts
// Empty string = Vite proxy handles routing in dev.
// In production, requests to /api/internal/* are proxied to the FastAPI backend.

export const BASE_URL = "";

export const ENDPOINTS = {
  internalBrokerData:  '/api/internal/broker-data',
  internalMarketData:  '/api/internal/market-data',
  internalTokenStatus: '/api/internal/token-status',

  login:          '/auth/login',
  refresh:        '/auth/refresh',
  logout:         '/auth/logout',
  changePassword: '/auth/change-password',
  me:             '/auth/me',

  adminBrokers: '/admin/brokers/',
  adminUsers:   '/admin/users/',
};

// adminBrokerById(brokerId) -> `/admin/brokers/${brokerId}`
// adminUserById(id)         -> `/admin/users/${id}`

// Threshold for market-share color coding (%)
export const MARKET_SHARE_THRESHOLD = 5;
```

> The frontend never calls the external broker API directly. Auto-credential
> pipeline auth/external-API access happens server-side in `/backend` (see
> "Backend: Auto-Credential Pipeline" below). Admin-panel auth (human users)
> uses JWTs issued by `/auth/*` and stored in `localStorage` via
> `services/tokenStorage.ts` — see "Admin Panel: Auth & User Management".

---

## Backend: Auto-Credential Pipeline (`/backend`)

A FastAPI + MySQL service replaces the old client-side login flow. It
authenticates against the external broker API
(`https://uat.xfltrade.com:20121`) using a fixed service account, runs on a
daily schedule (plus once at startup), and caches the latest broker/market data
in MySQL for the frontend to read via internal endpoints.

### Configuration (`backend/.env`, see `backend/.env.example`)

| Var | Purpose |
|-----|---------|
| `EXTERNAL_API_BASE_URL` | External broker API base (`https://uat.xfltrade.com:20121`) |
| `APP_TYPE` | `appType` field sent to `/api/login` |
| `AUTO_AUTH_USERNAME` / `AUTO_AUTH_PASSWORD` | Service-account credentials |
| `AUTO_AUTH_DEVICE_ID` | Fixed device UUID for the service account (MFA assumed disabled) |
| `SCHEDULED_TIME` | Daily pipeline run time, `HH:MM` (default `06:00`) |
| `APP_TIMEZONE` | Timezone for scheduling + "today" computation (default `Asia/Dhaka`) |
| `DEFAULT_STOCK_EXCHANGE` | Stock exchange used for the market fetch (default `DSE`) |
| `TOKEN_REFRESH_SKEW_MINUTES` | Refresh access token if it expires within this window |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL connection (`mysql+pymysql://`) |
| `BACKEND_HOST` / `BACKEND_PORT` | Uvicorn bind address |
| `CORS_ALLOW_ORIGINS` | Allowed origins for the frontend dev server |

`JWT_ACCESS_TOKEN`/`JWT_REFRESH_TOKEN` in `.env.example` are documentation
placeholders only — the live token cache lives in the `token_store` MySQL
table, not the `.env` file.

### Pipeline (`app/services/pipeline.py` → `run_pipeline()`)

1. Get a valid access token (`token_store` row; refresh if expiring within
   `TOKEN_REFRESH_SKEW_MINUTES`, or full login if no row exists).
2. Compute "today" in `APP_TIMEZONE`.
3. Fetch all pipeline-enabled brokers (`broker_service.list_brokers_for_pipeline()`
   — rows in the `brokers` table with a non-null `external_api_id`, ordered by
   `order_index`; sequential, per-broker error isolation) + market trade info
   for `DEFAULT_STOCK_EXCHANGE`.
4. If **all** brokers failed, refresh the token once and retry the fetch.
5. Upsert results into `broker_snapshots` / `market_snapshots`.
6. Record the run in `pipeline_logs` with status `success` / `partial` / `failed`.

If `isMfaRequired` is returned during login, the cycle is logged as `failed`
and skipped (MFA is assumed disabled for the service account).

### MySQL tables (auto-created via `Base.metadata.create_all()`)

- `token_store` — single row (`id=1`): `access_token`, `refresh_token`,
  `expires_at`, `user_id`, `updated_at`.
- `broker_snapshots` — one row per `(broker_id, from_date, to_date)`, upserted:
  `total_execution_report`, `total_trade`, `buy_trade`, `sell_trade`,
  `total_value`, `buy_value`, `sell_value`, `fetch_error`, `fetched_at`.
- `market_snapshots` — one row per `(stock_exchange, snapshot_date)`, upserted:
  `market_date`, `low`, `volume`, `trade`, `value`, `gainer`, `loser`,
  `unchanged`, `fetched_at`.
- `pipeline_logs` — append-only run history: `run_started_at`,
  `run_finished_at`, `status`, `duration_ms`, `brokers_ok`, `brokers_failed`,
  `market_ok`, `error_message`.

### Scheduler (`app/scheduler/jobs.py`)

`BackgroundScheduler` (timezone = `APP_TIMEZONE`) runs `run_pipeline()`:
- once immediately on app startup (job id `startup_run`), and
- daily via `CronTrigger` at `SCHEDULED_TIME` (job id `daily_pipeline`,
  `misfire_grace_time=None` — a missed daily slot is skipped rather than
  fired late, since `startup_run` already covers a fresh fetch after a
  restart).

### Internal endpoints (`app/routers/internal.py`, prefix `/api/internal`)

- `GET /api/internal/broker-data` → `BrokerDataResponse` — most recent
  snapshot per pipeline-enabled broker (ordered by `brokers.order_index`,
  backfilled from `app/config_data/brokers.py`). Brokers with no snapshot yet
  return `fetchError: true` + zeroed fields. A `role="user"` caller with a
  `broker_id` assignment sees only their own broker's row.
- `GET /api/internal/market-data` → `MarketDataResponse` — most recent snapshot
  for `DEFAULT_STOCK_EXCHANGE`, or `{ success: false, market: null }` if none.
- `GET /api/internal/token-status` → token validity, `expiresAt`,
  `nextScheduledRun` (from the scheduler), and the most recent `pipeline_logs` row.
- `POST /api/internal/trigger-pipeline` → runs `run_pipeline()` in the
  background, returns `{ "triggered": true }` (manual/testing use).

> Important: `app/config_data/brokers.py` must be kept in sync with
> `src/config/brokers.ts` (same broker IDs/labels, same order) — it's the
> seed/backfill source for the `brokers` table's `external_api_id` and
> `order_index` columns (matched by `broker_label`), which is what the
> pipeline and `/api/internal/broker-data` actually read at runtime.

See `backend/README.md` for setup/run instructions.

---

## Admin Panel: Auth & User Management

A separate, human-facing JWT auth system for the dashboard itself —
independent from the auto-credential pipeline above. Roles: `admin` (manages
brokers + users) and `user` (views `/dashboard`, can change their own
password).

### Configuration (`backend/.env`)

| Var | Purpose |
|-----|---------|
| `JWT_SECRET_KEY` | HMAC signing key for access/refresh tokens (required, no default) |
| `JWT_ALGORITHM` | Default `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Default `30` |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Default `7` |

### MySQL tables (auto-created via `Base.metadata.create_all()`)

- `brokers` — `broker_id` (PK, e.g. `"SNM"`), `broker_label`, `external_api_id`
  (24-char external-API ObjectId, nullable), `order_index` (nullable),
  timestamps. Seeded from `app/config_data/brokers.py` on first startup
  (`broker_service.seed_brokers`, including `external_api_id`/`order_index`),
  editable thereafter via the admin panel. This table is now the runtime
  source for the pipeline's broker list (see `list_brokers_for_pipeline`):
  rows with a non-null `external_api_id` are fetched, ordered by
  `order_index`. Brokers added via the admin UI with no matching
  `config_data/brokers.py` entry have `external_api_id`/`order_index = NULL`
  and are excluded from the pipeline (admin-CRUD/user-assignment only).
- `users` — `id`, `email` (unique), `password_hash` (bcrypt via passlib),
  `role` (`admin`/`user`), `broker_id` (nullable FK → `brokers.broker_id`),
  `is_active`, `must_change_password`, timestamps.
- `token_blacklist` — `id`, `jti` (unique), `expires_at`. Refresh-token `jti`s
  are inserted here on logout; `get_current_user`/`/auth/refresh` reject any
  token whose `jti` appears here.

### Seeding (`app/main.py` lifespan, after `create_all()`)

- `broker_service.seed_brokers()` — on a fresh `brokers` table, seeds all 15
  rows (with `external_api_id`/`order_index`) from
  `app/config_data/brokers.py`. On an existing table, idempotently backfills
  `external_api_id`/`order_index` for rows where they're still `NULL`,
  matched by `broker_label` (runs every startup, but is a no-op once
  backfilled). `app/db/schema_upgrades.ensure_broker_columns()` adds these
  two columns to a pre-existing `brokers` table before seeding runs, since
  `create_all()` doesn't alter existing tables.
- `user_service.seed_default_admin()` — no-op if `users` is non-empty;
  otherwise creates `admin@xfl.com` / `Admin@1234`, `role="admin"`,
  `must_change_password=True`. **Change this password after first login.**

### Endpoints

- `POST /auth/login` — `{ email, password }` → `{ accessToken, refreshToken, tokenType }`.
- `POST /auth/refresh` — `{ refreshToken }` → new token pair (rejects blacklisted/expired).
- `POST /auth/logout` — `{ refreshToken }` → blacklists its `jti`.
- `POST /auth/change-password` — auth required; `{ currentPassword, newPassword }`,
  clears `must_change_password`.
- `GET /auth/me` — auth required → `{ id, email, role, brokerId, mustChangePassword }`.
- `GET/POST /admin/brokers/`, `PUT/DELETE /admin/brokers/{broker_id}` — admin only.
  Delete is blocked (409) if a user references the broker.
- `GET/POST /admin/users/`, `PUT/DELETE /admin/users/{id}` — admin only.
  Delete is blocked (400) for `current_user.id == id` (no self-deletion).

### Frontend

- `services/tokenStorage.ts` persists `{ accessToken, refreshToken }` in
  `localStorage`. `services/httpClient.ts` is a shared axios instance used by
  `apiService.ts`/`authService.ts`/`adminService.ts`: it attaches
  `Authorization: Bearer <accessToken>` to every request and, on a `401`,
  calls `/auth/refresh` once and retries — clearing storage and redirecting to
  `/login` if that also fails.
- `context/AuthContext.tsx` (`AuthProvider`/`useAuth`) hydrates `user` via
  `/auth/me` on mount if a token exists; exposes `login`/`logout`/`refreshUser`.
- `components/ProtectedRoute.tsx` redirects to `/login` if unauthenticated, or
  to `/dashboard`/`/admin` if the user's role isn't in the route's `roles` list.
- Routes (`src/App.tsx`): `/login` (public), `/` (role-based redirect),
  `/dashboard` (`user`/`admin`), `/profile` (change password, any role),
  `/admin` (`admin` only) → `AdminLayout` with `/admin/brokers` and
  `/admin/users`.

---

## TypeScript Interfaces (`src/types/index.ts`)

```ts
// Unwrapped broker data per broker fetch
export interface BrokerData {
  totalExecutionReport: number;
  totalTrade:           number;
  buyTrade:             number;
  sellTrade:            number;
  totalValue:           number;
  buyValue:             number;
  sellValue:            number;
}

// Per-broker table row (includes broker identity + derived metrics)
export interface BrokerRow extends BrokerData {
  brokerId:   string;
  label:      string;
  fetchError: boolean;
  // derived:
  tradeSharePct:  number; // broker totalTrade / market.trade * 100
  valueSharePct:  number; // broker totalValue / market.value * 100
}

// Summed across all brokers
export interface AggregateRow extends BrokerData {
  tradeSharePct: number;
  valueSharePct: number;
}

// Unwrapped market data
export interface MarketRow {
  date:      string;
  low:       number;
  volume:    number;
  trade:     number;
  value:     number;
  gainer:    number;
  loser:     number;
  unchanged: number;
}

export interface DashboardParams {
  fromDate:      string;
  toDate:        string;
  stockExchange: string;
}

export interface DashboardData {
  brokerRows:    BrokerRow[];
  aggregateRow:  AggregateRow;
  marketRow:     MarketRow | null;
  loading:       boolean;
  error:         string | null;
}

// Raw shapes returned by the internal backend endpoints
export interface BrokerRowApi {
  brokerId:             string;
  label:                string;
  fetchError:           boolean;
  totalExecutionReport: number;
  totalTrade:           number;
  buyTrade:             number;
  sellTrade:            number;
  totalValue:           number;
  buyValue:             number;
  sellValue:            number;
}

export interface BrokerDataResponse {
  success:   boolean;
  fromDate:  string;
  toDate:    string;
  fetchedAt: string | null;
  brokers:   BrokerRowApi[];
}

export interface MarketDataResponse {
  success:       boolean;
  stockExchange: string;
  fetchedAt:     string | null;
  market:        MarketRow | null;
}
```

---

## Data Aggregation Logic

After all fetches resolve:

```
aggregateRow.totalTrade  = sum(brokerRows[i].totalTrade)
aggregateRow.totalValue  = sum(brokerRows[i].totalValue)
aggregateRow.buyTrade    = sum(brokerRows[i].buyTrade)
aggregateRow.sellTrade   = sum(brokerRows[i].sellTrade)
aggregateRow.buyValue    = sum(brokerRows[i].buyValue)
aggregateRow.sellValue   = sum(brokerRows[i].sellValue)
aggregateRow.totalExecutionReport = sum(brokerRows[i].totalExecutionReport)

// Derived share metrics (against market endpoint 2 data):
brokerRow.tradeSharePct  = brokerRow.totalTrade  / marketRow.trade * 100
brokerRow.valueSharePct  = brokerRow.totalValue  / marketRow.value * 100
aggregateRow.tradeSharePct = aggregateRow.totalTrade  / marketRow.trade * 100
aggregateRow.valueSharePct = aggregateRow.totalValue  / marketRow.value * 100
```

---

## Components

### `FilterBar`

Inputs:
- `fromDate` — date picker, default today
- `toDate` — date picker, default today
- `stockExchange` — text input or select, default `"DSE"`
- **Fetch** button → triggers `useDashboardData` reload

> **Known v1 limitation**: the internal endpoints always serve the latest
> cached snapshot (effectively "today"), regardless of the selected
> `fromDate`/`toDate`/`stockExchange`. `FilterBar` remains visible and the
> **Fetch** button still triggers a reload, but changing the filter values has
> no effect on the data returned. Date-range/exchange-aware querying would
> require the backend to store and serve historical snapshots per filter
> combination — out of scope for v1.

### `ComparisonTable`

Columns:

| Broker | Exec Reports | Total Trade | Buy Trade | Sell Trade | Total Value | Buy Value | Sell Value | Trade Share % | Value Share % |
|--------|-------------|-------------|-----------|------------|-------------|-----------|------------|---------------|---------------|
| SNM    | …           | …           | …         | …          | …           | …         | …          | colored %     | colored %     |
| BAL    | …           | …           | …         | …          | …           | …         | …          | colored %     | colored %     |
| **Σ Aggregate** | … | …      | …         | …          | …           | …         | …          | …             | …             |
| **Market** | —      | `trade`     | —         | —          | `value`     | —         | —          | 100%          | 100%          |

Color rules for share % cells:
- `>= MARKET_SHARE_THRESHOLD` → green badge
- `< MARKET_SHARE_THRESHOLD` → amber badge
- `fetchError` row → red/strikethrough

### `ComparisonChart`

`ComposedChart` with two chart groups:

**Group A — Trade Count:**
- `Bar` per broker: `totalTrade`
- `Bar` aggregate: `aggregateRow.totalTrade`
- `ReferenceLine` at `marketRow.trade`

**Group B — Value:**
- `Bar` per broker: `totalValue`
- `Bar` aggregate: `aggregateRow.totalValue`
- `ReferenceLine` at `marketRow.value`

X-axis: broker labels + "Aggregate"  
Tooltip: absolute value + share %

---

## `useDashboardData` Hook

```ts
// src/hooks/useDashboardData.ts
function useDashboardData(params: DashboardParams): DashboardData

// Internal flow:
// 1. Promise.all → fetchInternalBrokerData() + fetchInternalMarketData()
//    (each call wrapped in .catch(() => null) so one failure doesn't sink the other)
// 2. If broker response present, map BrokerRowApi[] -> BrokerRow[]
//    (tradeSharePct/valueSharePct initialized to 0); else fall back to
//    BROKERS from config/brokers.ts with fetchError: true and zeroed data,
//    and set an error message ("Broker data unavailable — internal API unreachable.")
// 3. If market response has `market`, use it as marketRow; else marketRow = null
//    and set error = 'Market data unavailable — share % disabled.'
// 4. Compute aggregateRow (sums across brokerRows)
// 5. Compute per-row + aggregate derived share metrics against marketRow
//    (skipped/0 if marketRow is null)
// 6. Return { brokerRows, aggregateRow, marketRow, loading, error }
//
// `params` (fromDate/toDate/stockExchange) are accepted for the FilterBar's
// sake but have no effect on which data is returned — see the FilterBar
// "Known v1 limitation" note above.
```

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| `/api/internal/broker-data` unreachable or errors | All `brokerRows` get `fetchError: true` + zeroed data (from `config/brokers.ts`); `error` set |
| Individual broker has no snapshot yet | That row gets `fetchError: true` + zeroed data; rest continue |
| `/api/internal/market-data` unreachable, errors, or `market: null` | `marketRow = null`; banner warning; share % columns show `N/A` |
| `success: false` in either internal response | Treated as unavailable per above |

Auth/refresh/MFA failures against the **external** API are handled entirely
inside the backend pipeline (see `pipeline_logs` / `/api/internal/token-status`)
and never surface as frontend-visible auth errors — the frontend simply sees
stale or missing snapshot data until the next successful pipeline run.

---

## Hardcoded vs Configurable

| Item | Type | Location |
|------|------|----------|
| Broker IDs + labels (frontend) | Hardcoded | `src/config/brokers.ts` |
| Broker IDs + labels (backend, seed/backfill data) | Hardcoded, must mirror frontend | `backend/app/config_data/brokers.py` |
| Broker list used by pipeline at runtime | DB (`brokers` table, seeded/backfilled from the above) | `backend/app/models/broker.py` |
| Internal endpoint paths | Hardcoded | `src/config/api.ts` |
| Market share threshold | Hardcoded const | `src/config/api.ts` |
| External API base URL, service-account credentials, schedule, DB connection | Env vars | `backend/.env` |
| Date range / Stock Exchange | UI-configurable, but no effect on data (v1) | `FilterBar` |

---

## Setup

### Frontend

```bash
npm install
npm run dev
```

**`vite.config.ts`** proxies API calls to the FastAPI backend in dev:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/internal': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

No `.env.local` is needed by the frontend — admin-panel JWTs are stored in
`localStorage` (see "Admin Panel: Auth & User Management"), not in env files.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate     # Windows
pip install -r requirements.txt
copy .env.example .env     # then fill in credentials/DB connection
uvicorn app.main:app --reload --port 8000
```

On startup the backend creates its MySQL tables (if missing), runs the pipeline
once immediately, and schedules the daily run at `SCHEDULED_TIME`. See
`backend/README.md` for full details.

### Production

- Frontend: `npm run build`, served by nginx (`dashboard.conf`).
- Backend: run `uvicorn` (or behind a process manager) on `127.0.0.1:8000`.
- nginx proxies `location /api/internal/`, `/auth/`, and `/admin/` to the
  backend; everything else is served from the built frontend
  (`try_files ... /index.html`), so client-side routes like `/admin/brokers`
  fall through to `index.html` while API calls to `/admin/*` reach FastAPI.

---

## Key Notes

These notes apply to the **external broker API** as consumed by
`backend/app/services/external_api.py`:

- `$id` fields in all external responses are serialization artifacts — ignored
  by the backend, never mapped to the internal schemas.
- `date: "0001-01-01T00:00:00"` in the market response = server returning a
  default when no date filter applies — stored as-is in `market_snapshots.market_date`;
  the frontend's `MarketRow.date` should display `"—"` for this value.
- `value` in the market response appears to be in a different unit than broker
  `totalValue` — verify units before relying on `tradeSharePct`/`valueSharePct`
  (may need a multiplier in the frontend's share calculation).
- The market-trade-info endpoint takes **no** `X-BrokerId` header — only
  `Authorization: Bearer`. `external_api.fetch_market_trade_info` must not send it.

---

## Future Enhancements (Out of Scope)

- Export to CSV/XLSX
- Date range presets (Today, Last 7 days)
- Multi-exchange tabs
- WebSocket live updates

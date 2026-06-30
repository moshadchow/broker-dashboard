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
│   └── adminService.ts      # Admin CRUD for brokers/users/oms-endpoints (/admin/*)
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
│       ├── UserManagement.tsx    # CRUD UI for `users` table (role/broker assignment)
│       └── EndpointManagement.tsx # CRUD UI for `oms_endpoints` table (base URL + credentials)
├── types/
│   ├── index.ts            # Dashboard TS interfaces
│   └── auth.ts             # Admin-panel auth/user/broker TS interfaces
└── App.tsx                 # BrowserRouter + AuthProvider + route table

backend/
├── app/
│   ├── main.py              # FastAPI app, lifespan (DB init + seeding + scheduler), CORS, routers
│   ├── config.py            # Settings (.env), incl. JWT settings
│   ├── db/                  # SQLAlchemy engine/session, schema_upgrades.py (idempotent ALTERs)
│   ├── models/              # token_store, broker_snapshots, market_snapshots, pipeline_logs,
│   │                         # + admin panel: user, broker, token_blacklist, oms_endpoint
│   ├── schemas/              # Pydantic models: internal endpoints + auth/user/admin_broker/admin_oms_endpoint
│   ├── config_data/
│   │   ├── brokers.py        # BROKERS — seed/backfill source for the `brokers` table
│   │   │                       # (external_api_id, order_index), keep in sync with src/config/brokers.ts
│   │   └── oms_endpoints.py  # One-time seed source for the `oms_endpoints` table, read from .env
│   ├── dependencies/auth.py # get_current_user, require_admin (JWT + blacklist checks)
│   ├── services/
│   │   ├── external_api.py  # httpx calls to external broker API
│   │   ├── auth_service.py  # auth()/refresh + token_store CRUD (pipeline service account)
│   │   ├── fetch_service.py # fetch_all(db, ...): pipeline-enabled brokers (from `brokers` table) + market
│   │   ├── store_service.py # upserts into snapshot tables + pipeline_logs
│   │   ├── pipeline.py      # run_pipeline(): orchestration
│   │   ├── password_service.py # bcrypt hash/verify (admin panel)
│   │   ├── encryption_service.py # Fernet encrypt/decrypt (oms_endpoints.encrypted_password)
│   │   ├── jwt_service.py      # access/refresh token create + decode (admin panel)
│   │   ├── user_service.py     # admin `users` table CRUD + seed_default_admin
│   │   ├── broker_service.py   # admin `brokers` table CRUD + seed_brokers (+ pipeline broker list)
│   │   └── oms_endpoint_service.py # admin `oms_endpoints` table CRUD + seed + get_active_endpoints(db)
│   ├── scheduler/jobs.py    # APScheduler: startup run + daily cron
│   └── routers/
│       ├── internal.py      # /api/internal/* endpoints (pipeline data, unauthenticated)
│       ├── auth.py          # /auth/* — login, refresh, logout, change-password, me
│       ├── admin_brokers.py # /admin/brokers/* — admin-only broker CRUD
│       ├── admin_users.py   # /admin/users/* — admin-only user CRUD
│       └── admin_oms_endpoints.py # /admin/oms-endpoints/* — admin-only OMS endpoint CRUD
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

  adminBrokers:      '/admin/brokers/',
  adminUsers:        '/admin/users/',
  adminOmsEndpoints: '/admin/oms-endpoints/',
};

// adminBrokerById(brokerId)     -> `/admin/brokers/${brokerId}`
// adminUserById(id)             -> `/admin/users/${id}`
// adminOmsEndpointByName(name)  -> `/admin/oms-endpoints/${name}`

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
authenticates against **three** external OMS APIs (primary, secondary, PUJI —
see "Multi-endpoint OMS routing" below) using fixed service accounts, runs on
a daily schedule (plus once at startup), and caches the latest broker/market
data in MySQL for the frontend to read via internal endpoints.

### Configuration (`backend/.env`, see `backend/.env.example`)

| Var | Purpose |
|-----|---------|
| `APP_ENCRYPTION_KEY` | Fernet symmetric key used to encrypt/decrypt `oms_endpoints.encrypted_password`. Required before creating any `oms_endpoints` row. Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`. **Rotating this key breaks all existing encrypted passwords** (`InvalidToken` on decrypt) — rotation requires manually re-entering every endpoint's password via the admin UI afterward |
| `SCHEDULED_TIME` | Daily pipeline run time, `HH:MM` (default `06:00`) |
| `APP_TIMEZONE` | Timezone for scheduling + "today" computation (default `Asia/Dhaka`) |
| `DEFAULT_STOCK_EXCHANGE` | Stock exchange used for the market fetch (default `DSE`) |
| `TOKEN_REFRESH_SKEW_MINUTES` | Refresh access token if it expires within this window |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL connection (`mysql+pymysql://`) |
| `BACKEND_HOST` / `BACKEND_PORT` | Uvicorn bind address |
| `CORS_ALLOW_ORIGINS` | Allowed origins for the frontend dev server |

There is no `.env`-based bootstrap for OMS API base URLs or service-account
credentials — those live exclusively in the `oms_endpoints` database table,
created and edited via the admin panel (**API Endpoints**,
`/admin/oms-endpoints`). On a fresh install the table starts empty; an admin
must create the `primary` (and `secondary`/`puji`/`market`, as needed) rows
there before the pipeline has anything to fetch. The live token cache lives
in the `token_store` MySQL table, not the `.env` file.

### Multi-endpoint OMS routing

The OMS endpoint registry is a real DB-backed entity, the `oms_endpoints`
table (`name` PK, `base_url`, `credential_name`, `username`,
`encrypted_password`, `device_id`, `app_type`), managed via the admin panel
(**API Endpoints**, `/admin/oms-endpoints`, see "Admin Panel: Auth & User
Management" below) — not `.env` edits + a restart. `app/services/
oms_endpoint_service.get_active_endpoints(db) -> dict[str, OmsEndpoint]`
reads this table and decrypts each row's password (Fernet, via
`encryption_service.py`) into the same `OmsEndpoint`/`CredentialSet` frozen
dataclasses (`app/config.py`) that `auth_service.py`/`external_api.py`/
`fetch_service.py` have always consumed — those three modules are unchanged.

Each `brokers` row has an `api_endpoint` column (nullable; defaults to
`"primary"` when unset, FK → `oms_endpoints.name`) saying which one OMS
endpoint that broker's data is fetched from — **a broker belongs to exactly
one endpoint**, never queried against more than one. `app/config_data/
brokers.py` seeds this (`FCS` → `"puji"`, matching its dedicated credential
username `fcs_xfl_broker_trade_api`; all others → `"primary"`); admins can
reassign a broker's endpoint via `PUT /admin/brokers/{broker_id}`
(`apiEndpoint` field, now a dropdown sourced from `oms_endpoints` in
`BrokerManagement.tsx`), and that assignment is never overwritten by the
seed/backfill logic once set. Deleting an `oms_endpoints` row is blocked
(409) while any broker still references it — both at the app level
(`oms_endpoint_service.delete_oms_endpoint`) and the DB level (FK `ON DELETE
RESTRICT`).

Market-trade-info is fetched using a dedicated `oms_endpoints` row named
`"market"` (`oms_endpoint_service.get_endpoint_credentials(db, "market")`),
separate from any broker-data endpoint — it is not part of `brokers.
api_endpoint` routing and brokers never reference it. The pipeline raises if
no `"market"` row exists, since the market fetch has no `.env` fallback
anymore — an admin must create this row (typically `credential_name=
"market_trade"`, the existing `token_store` key) before the first run.

Adding a new OMS endpoint (including `"market"` on a fresh install): create
it via the admin UI (`/admin/oms-endpoints`) with its base URL + credentials,
then route brokers to it via `/admin/brokers` — no pipeline code changes, no
redeploy. There is no seed step; `oms_endpoints` starts empty on a fresh
database and is populated entirely through the admin panel.

### Pipeline (`app/services/pipeline.py` → `run_pipeline()`)

1. Determine which endpoints have at least one pipeline-enabled broker routed
   to them, and acquire a token for each (`token_store` row per
   `credentials.name`; refresh if expiring within `TOKEN_REFRESH_SKEW_MINUTES`,
   full login if no row exists). A token failure on one endpoint is isolated —
   it does not block acquiring tokens for the others.
2. Compute "today" in `APP_TIMEZONE`.
3. Fetch all pipeline-enabled brokers (`broker_service.list_brokers_for_pipeline()`
   — rows in the `brokers` table with a non-null `external_api_id`, ordered by
   `order_index`), grouped by `api_endpoint` and fetched from that endpoint's
   base URL/token; per-broker error isolation. Separately fetch market trade
   info for `DEFAULT_STOCK_EXCHANGE` using the dedicated `"market"`
   `oms_endpoints` row (its own token, acquired the same way as a broker
   endpoint's).
4. For any endpoint where **all** of its brokers failed, refresh that
   endpoint's token once and retry just that endpoint's brokers (endpoints
   that already succeeded are not re-fetched).
5. Upsert results into `broker_snapshots` / `market_snapshots`.
6. Record the run in `pipeline_logs` with status `success` / `partial` / `failed`,
   plus a log line summarizing per-endpoint auth/fetch outcomes.

If `isMfaRequired` is returned during login, the cycle is logged as `failed`
and skipped (MFA is assumed disabled for all service accounts).

### MySQL tables (auto-created via `Base.metadata.create_all()`)

- `oms_endpoints` — one row per OMS endpoint (`name` PK, e.g. `"primary"`,
  `"secondary"`, `"puji"`, `"market"`): `base_url`, `credential_name` (unique,
  the `token_store` row key, e.g. `"puji_oms"` — distinct from `name` so
  `token_store` keys stay stable even if an endpoint is renamed-by-recreation),
  `username`, `encrypted_password` (Fernet, via `encryption_service.py`),
  `device_id`, `app_type`, timestamps. Starts empty on a fresh database —
  fully admin-managed via `/admin/oms-endpoints`, no `.env` seed. See
  "Multi-endpoint OMS routing" above.
- `token_store` — one row per `credential_name` (e.g. `broker_summary`,
  `market_trade`, `secondary_oms`, `puji_oms`): `access_token`,
  `refresh_token`, `expires_at`, `user_id`, `updated_at`.
- `broker_snapshots` — one row per `(broker_id, from_date, to_date)`, upserted:
  `total_execution_report`, `total_trade`, `buy_trade`, `sell_trade`,
  `total_value`, `buy_value`, `sell_value`, `fetch_error`, `fetched_at`.
  `broker_id` here is the internal `brokers.broker_id` (e.g. `"FCS"`), not the
  OMS-side id — since each broker is routed to exactly one endpoint, this key
  remains unique across all endpoints with no schema change needed.
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
  `nextScheduledRun` (from the scheduler), the most recent `pipeline_logs`
  row, and an `endpoints` array with per-OMS-endpoint token health
  (`endpoint`, `hasToken`, `valid`, `expiresAt`, `lastUpdated`) — the
  top-level `hasToken`/`valid`/`expiresAt`/`lastUpdated` fields remain the
  primary endpoint's status for backward compatibility.
- `POST /api/internal/trigger-pipeline` → runs `run_pipeline()` in the
  background, returns `{ "triggered": true }` (manual/testing use).

> Important: `app/config_data/brokers.py` must be kept in sync with
> `src/config/brokers.ts` (same broker IDs/labels, same order) — it's the
> seed/backfill source for the `brokers` table's `external_api_id`,
> `order_index`, and `api_endpoint` columns (matched by `broker_label`),
> which is what the pipeline and `/api/internal/broker-data` actually read at
> runtime. `src/config/brokers.ts` does not need `api_endpoint` — that's a
> backend-only routing concern.

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

(`oms_endpoints` is documented under "Multi-endpoint OMS routing" /
"Backend: Auto-Credential Pipeline" above — it's a single registry shared by
both the pipeline and this admin module, not duplicated here.)

- `brokers` — `broker_id` (PK, e.g. `"SNM"`), `broker_label`, `external_api_id`
  (24-char external-API ObjectId, nullable), `order_index` (nullable),
  `api_endpoint` (nullable; `"primary"` / `"secondary"` / `"puji"`, see
  "Multi-endpoint OMS routing" above — `NULL` is treated as `"primary"`),
  timestamps. Seeded from `app/config_data/brokers.py` on first startup
  (`broker_service.seed_brokers`, including `external_api_id`/`order_index`/
  `api_endpoint`), editable thereafter via the admin panel — once an
  `api_endpoint` value is set (seeded or admin-edited) it is never
  overwritten by the seed/backfill logic again. This table is now the
  runtime source for the pipeline's broker list (see
  `list_brokers_for_pipeline`): rows with a non-null `external_api_id` are
  fetched, grouped by `api_endpoint`, ordered by `order_index`. Brokers added
  via the admin UI with no matching `config_data/brokers.py` entry have
  `external_api_id`/`order_index = NULL` and are excluded from the pipeline
  (admin-CRUD/user-assignment only).
- `users` — `id`, `email` (unique), `password_hash` (bcrypt via passlib),
  `role` (`admin`/`user`), `broker_id` (nullable FK → `brokers.broker_id`),
  `is_active`, `must_change_password`, timestamps.
- `token_blacklist` — `id`, `jti` (unique), `expires_at`. Refresh-token `jti`s
  are inserted here on logout; `get_current_user`/`/auth/refresh` reject any
  token whose `jti` appears here.

### Seeding (`app/main.py` lifespan, after `create_all()`)

`app/db/schema_upgrades.ensure_oms_endpoint_fk()` (which adds the
`brokers.api_endpoint -> oms_endpoints.name` FK) must run **after**
`broker_service.seed_brokers()` (which backfills `brokers.api_endpoint`) —
otherwise the `ALTER TABLE ADD CONSTRAINT` could fail against rows that
don't yet match an `oms_endpoints` row. There is no `oms_endpoints` seed
step — the table starts empty on a fresh database; an admin populates it via
`/admin/oms-endpoints` after first login. Full lifespan order:
`ensure_token_store_credential_name` → `create_all()` →
`ensure_broker_columns` → `seed_brokers` → `seed_default_admin` →
`ensure_oms_endpoint_fk` → start scheduler.

- `broker_service.seed_brokers()` — on a fresh `brokers` table, seeds all 15
  rows (with `external_api_id`/`order_index`/`api_endpoint`) from
  `app/config_data/brokers.py`. On an existing table, idempotently backfills
  `external_api_id`/`order_index`/`api_endpoint` for rows where they're still
  `NULL`, matched by `broker_label` (runs every startup, but is a no-op once
  backfilled). `app/db/schema_upgrades.ensure_broker_columns()` adds these
  columns to a pre-existing `brokers` table before seeding runs, since
  `create_all()` doesn't alter existing tables.
- `user_service.seed_default_admin()` — no-op if `users` is non-empty;
  otherwise creates `admin@xfl.com` / `Admin@1234`, `role="admin"`,
  `must_change_password=True`. **Change this password after first login.**
- `app/db/schema_upgrades.ensure_oms_endpoint_fk()` — idempotent (skips if
  the FK already exists); defensively nulls out any `brokers.api_endpoint`
  value with no matching `oms_endpoints` row (should never fire in the happy
  path — logged as a warning if it does) before adding the FK constraint.

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
- `GET/POST /admin/oms-endpoints/`, `PUT/DELETE /admin/oms-endpoints/{name}`
  — admin only. `name` is immutable after creation (it's the primary key and
  the `brokers.api_endpoint` FK target); `credentialName` is also immutable
  after creation (changing it would orphan the existing `token_store` row).
  `password` is write-only — never returned by `GET`/`POST`/`PUT` responses;
  omit/null it on `PUT` to leave the stored password unchanged. Delete is
  blocked (409) if any `brokers.api_endpoint` row references the endpoint.

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
  `/admin` (`admin` only) → `AdminLayout` with `/admin/brokers`,
  `/admin/users`, and `/admin/oms-endpoints`.

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
| Broker IDs + labels + OMS endpoint (backend, seed/backfill data) | Hardcoded, IDs/labels must mirror frontend | `backend/app/config_data/brokers.py` |
| Broker list + OMS endpoint routing used by pipeline at runtime | DB (`brokers` table, seeded/backfilled from the above, admin-editable) | `backend/app/models/broker.py` |
| OMS endpoint registry (primary/secondary/puji/market base URLs + credentials) | DB only (`oms_endpoints` table, fully admin-managed via `/admin/oms-endpoints`, no `.env` involvement) | `backend/app/models/oms_endpoint.py`, `backend/app/services/oms_endpoint_service.py` |
| Internal endpoint paths | Hardcoded | `src/config/api.ts` |
| Market share threshold | Hardcoded const | `src/config/api.ts` |
| Encryption key, schedule, DB connection, JWT settings | Env vars | `backend/.env` |
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

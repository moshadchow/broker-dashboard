# Repository Guidelines

## Project Structure

React/Vite frontend (`src/`) + FastAPI/MySQL backend (`backend/`). Frontend: `components/`, `components/admin/`, `services/`, `hooks/`, `context/`, `config/`, `types/`. Backend: `routers/`, `services/`, `models/`, `schemas/`, `db/`, `dependencies/`, `scheduler/`, `config_data/`. Do not commit `dist/`, `node_modules/`, `.venv/`, `__pycache__/`, or `.env` files.

## Commands

**Frontend** (repo root):
```
npm install
npm run dev          # Vite dev server, proxies /api/internal, /auth, /admin to :8000
npm run build        # tsc -b && vite build (type-check + production build)
```

**Backend** (`backend/`):
```
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

No test suite or linter is configured. Verify frontend with `npm run build`. Verify backend by exercising endpoints manually.

## Architecture: Two Independent Auth Systems

This is the most common source of confusion:

1. **Auto-credential pipeline** (backend-only): FastAPI authenticates against the external broker API (`https://uat.xfltrade.com:20121`) using service accounts stored in the `oms_endpoints` DB table. Runs on APScheduler. The frontend never talks to the external API or handles these tokens.

2. **Admin panel JWT auth** (human users): `/auth/*` endpoints issue access/refresh tokens. Roles: `admin`, `user`. Completely independent from the pipeline — does not touch `token_store`, `broker_snapshots`, `market_snapshots`, or `pipeline_logs`.

## Exchange Configuration

Supported exchanges defined in `backend/app/config_data/exchanges.py`:
- `EXCHANGE_CONFIG`: DSE (`market_symbol=DSEX`, `market_path=DSE`), CSE (`market_symbol=CSCX`, `market_path=CSE`)
- `SUPPORTED_EXCHANGES`: `["DSE", "CSE"]`
- `validate_exchange()`: Normalizes input, rejects invalid values, defaults to "DSE"

The pipeline fetches data for **all** supported exchanges in each run. Internal APIs accept `stockExchange` query param (validated, defaults to "DSE").

## OMS Endpoints (Critical Setup)

The `oms_endpoints` table **starts empty** on a fresh database. An admin must create rows via `/admin/oms-endpoints` (typically `primary`, `secondary`, `puji`, `market`) before the pipeline has anything to fetch. There is no `.env` seed for these. Rotating `APP_ENCRYPTION_KEY` breaks all existing encrypted passwords — re-enter every endpoint's password via the admin UI afterward.

## Vite Proxy Gotcha

The `/admin` proxy in `vite.config.ts` has a `bypass` rule: browser navigations (`Accept: text/html`) serve `/index.html` for SPA routing, while API calls (axios, `Accept: application/json`) proxy through to the backend. Don't remove this bypass or admin SPA routes break on hard refresh.

## Backend Deployment

Run exactly **one** uvicorn worker. The in-process `BackgroundScheduler` (`backend/app/scheduler/jobs.py`) runs the daily pipeline — multiple workers duplicate pipeline runs. Use systemd `Restart=on-failure` for crash recovery, not multi-worker mode.

## Default Admin Account

On fresh DB with empty `users` table: `admin@xfl.com` / `Admin@1234`, `role=admin`, `must_change_password=True`. Change the password immediately after first login.

## Key Limitations

- `FilterBar` date range inputs have **no effect** on returned data — the internal endpoints always serve the latest cached snapshot (v1 limitation).
- Stock exchange selection **does** filter data — broker and market snapshots are stored per exchange.
- `$id` fields in external API responses are serialization artifacts — ignored.
- `date: "0001-01-01T00:00:00"` in market response = server default when no date filter applies — display as "—".

## Database Schema (Key Tables)

- `broker_snapshots`: `stock_exchange` + `broker_id` + `from_date` + `to_date` (unique), trade/value aggregates
- `market_snapshots`: `stock_exchange` + `snapshot_date` + `times` (unique), price/volume arrays
- `oms_endpoints`: `name` PK, `base_url`, encrypted credentials (admin-managed, starts empty)
- `brokers`: `broker_id` PK, `external_api_id`, `api_endpoint` FK → `oms_endpoints.name`
- `pipeline_logs`: append-only run history with status/duration/counts

## Production Deploy

Frontend: `npm run build`, served by nginx (`dashboard.conf`). Backend: uvicorn on `127.0.0.1:8000`. nginx proxies `/api/internal/`, `/auth/`, `/admin/` to backend; everything else serves `index.html` for client-side routing.

## Security

Never commit `.env`, service credentials, JWT secrets, or generated tokens. Backend config belongs in environment variables. See `CLAUDE.md` for full architecture details and `DEPLOYMENT.md` for production setup.

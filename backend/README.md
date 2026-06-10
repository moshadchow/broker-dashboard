# Broker Dashboard — Auto-Credential Backend

FastAPI service that replaces manual login: it authenticates against the
external broker API using a service account, runs a daily scheduled pipeline
to fetch broker/market data, caches it in MySQL, and serves it to the frontend
via internal endpoints.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # then fill in real values
```

Create the MySQL database (tables are created automatically on startup):

```sql
CREATE DATABASE broker_dashboard CHARACTER SET utf8mb4;
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

On startup the pipeline runs once immediately, then daily at `SCHEDULED_TIME`
(interpreted in `APP_TIMEZONE`).

## Endpoints

- `GET /api/internal/broker-data` — latest per-broker snapshot for all configured brokers
- `GET /api/internal/market-data` — latest market snapshot for `DEFAULT_STOCK_EXCHANGE`
- `GET /api/internal/token-status` — token validity, last update, next scheduled run
- `POST /api/internal/trigger-pipeline` — manually run the pipeline (useful for testing)

## Notes

- `JWT_ACCESS_TOKEN` / `JWT_REFRESH_TOKEN` in `.env` are placeholders only and are
  **not** written to at runtime. The real source of truth is the MySQL
  `token_store` table (single row, upserted on every auth/refresh) — writing
  tokens back to a `.env` file at runtime is fragile (file I/O races, read-only
  filesystems in containers).
- `app/config_data/brokers.py` mirrors `src/config/brokers.ts` — keep both in
  sync if brokers are added/removed.
- If the service account ever requires MFA (`isMfaRequired: true`), the pipeline
  logs an error to `pipeline_logs` and skips that cycle — no automated MFA flow
  exists.

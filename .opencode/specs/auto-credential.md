### Broker Dashboard – Auto-Credential Scheduled Pipeline (FastAPI + MySQL)
## Overview
Replace manual login with a fully automated backend pipeline. FastAPI runs a daily scheduled job using .env credentials to authenticate, fetch broker/market data, store in MySQL, and serve to frontend. Login form stays visible but disabled.

.env Variables (new additions)
envAUTO_AUTH_USERNAME=xxx
AUTO_AUTH_PASSWORD=xxx
SCHEDULED_TIME=06:00        # 24hr format, daily trigger
JWT_ACCESS_TOKEN=           # runtime-written by backend
JWT_REFRESH_TOKEN=          # runtime-written by backend

## Backend – FastAPI Pipeline
1. Scheduler (APScheduler)

On server start: run pipeline immediately once
Daily at SCHEDULED_TIME: re-run full pipeline
Pipeline steps:

auth() → POST login with .env creds → store access + refresh token in MySQL token_store table
fetch_data() → call broker/market endpoints using stored token
store_data() → upsert results into MySQL tables
If access token expires mid-day → auto-use refresh token → get new access token → retry fetch



2. Token Storage (MySQL table: token_store)
sqlid | access_token | refresh_token | expires_at | updated_at

Single-row table (upsert on each auth)
All internal API calls read token from this table

3. Internal Endpoint (Frontend → FastAPI)
GET /api/internal/broker-data   → returns latest stored broker data
GET /api/internal/market-data   → returns latest stored market data
GET /api/internal/token-status  → returns token validity + last_updated + next_scheduled_run

No auth required from frontend (internal only, same-origin or internal network)

4. Refresh Token Auto-Handling

Before every fetch: check expires_at from token_store
If expired or expiring within 5 min → call refresh endpoint → update token_store
If refresh also fails → log error, skip fetch cycle, alert via log


## Frontend Changes
# Login Form (stub)

Keep existing form visible
All inputs + submit button → disabled
Show banner/badge: "Auto-auth active – manual login disabled"
No API call on submit

# Data Fetching

Remove direct calls to uat.xfltrade.com:20121 from frontend
All data now fetched from FastAPI internal endpoints above
Keep Recharts dashboard rendering unchanged


# MySQL Schema (new tables)
sqltoken_store       -- single-row token cache
broker_snapshots  -- timestamped broker execution data
market_snapshots  -- timestamped market trade data
pipeline_logs     -- each run: status, errors, duration, timestamp

# Implementation Order

MySQL schema + models
Token store CRUD (read/write access + refresh token)
Auth service (login + refresh logic)
Data fetch service (broker + market)
Store service (upsert snapshots)
APScheduler setup (startup + daily cron)
Internal endpoints (3 routes)
Frontend: disable login form + swap data fetch URLs
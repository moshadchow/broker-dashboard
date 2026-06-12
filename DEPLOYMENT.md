# Deployment Guide — AlmaLinux

Step-by-step instructions to deploy `broker-dashboard` (React frontend +
FastAPI/MySQL backend) on an AlmaLinux server that already runs nginx and
MariaDB/MySQL for other applications.

**Assumed layout** (adjust to match your server's conventions):
- App source checkout: `/var/www/broker-dashboard` (repo root)
- Built frontend (served by nginx): `/var/www/broker-dashboard/dist`
- Backend service: runs from `/var/www/broker-dashboard/backend` using its
  own virtualenv (`.venv`)
- nginx vhost: `dashboard.conf` (repo root) → `/etc/nginx/conf.d/`
- Public URL: `http://<server-ip>:8008` (per `dashboard.conf`)
- Backend listens on `127.0.0.1:8000` (not exposed publicly)

---

## 1. Prerequisites check

Run these to confirm the tools below are already installed (they should be,
since other apps run on this box):

```bash
node -v          # Node 18+ recommended
npm -v
python3 -V       # Python 3.10+
nginx -v
mysql --version  # or mariadb --version
git --version
```

If any are missing, install via `dnf` before continuing.

Note: AlmaLinux ships with SELinux **enforcing** and `firewalld` enabled by
default — both are addressed in step 8.

---

## 2. Get the code onto the server

```bash
sudo mkdir -p /var/www/broker-dashboard
sudo chown $(whoami):$(whoami) /var/www/broker-dashboard
git clone <your-repo-url> /var/www/broker-dashboard
cd /var/www/broker-dashboard
```

(If the repo is already cloned, just `git pull` to update.)

---

## 3. Database setup

Log into MySQL/MariaDB as root (or an admin user) and create a dedicated
database + user for this app:

```sql
CREATE DATABASE broker_db CHARACTER SET utf8mb4;
CREATE USER 'xfluser'@'localhost' IDENTIFIED BY 'Xfl$123%';
GRANT ALL PRIVILEGES ON broker_db.* TO 'xfluser'@'localhost';
FLUSH PRIVILEGES;
```

You'll reference `broker_db` / `CHANGE_ME_STRONG_PASSWORD` / `broker_dashboard`
in `backend/.env` below (`DB_USER`, `DB_PASSWORD`, `DB_NAME`).

Tables are created automatically by the app on first startup — no manual
schema/migration step needed.

---

## 4. Backend setup

```bash
cd /var/www/broker-dashboard/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and fill in real values:

| Variable | Value |
|---|---|
| `EXTERNAL_API_BASE_URL` | `https://uat.xfltrade.com:20121` (or prod URL) |
| `AUTO_AUTH_USERNAME` / `AUTO_AUTH_PASSWORD` | Real service-account credentials |
| `AUTO_AUTH_DEVICE_ID` | Fixed device UUID for the service account |
| `SCHEDULED_TIME` | e.g. `06:00` |
| `APP_TIMEZONE` | e.g. `Asia/Dhaka` |
| `DEFAULT_STOCK_EXCHANGE` | e.g. `DSE` |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_USER` | `broker_db` |
| `DB_PASSWORD` | the password set in step 3 |
| `DB_NAME` | `broker_dashboard` |
| `BACKEND_HOST` | `0.0.0.0` |
| `BACKEND_PORT` | `8000` |
| `CORS_ALLOW_ORIGINS` | `http://<server-ip>:8008` (must match the public dashboard URL) |
| `JWT_SECRET_KEY` | generate below — **do not leave the example default** |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | `7` |

Generate a strong JWT secret:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Test run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Confirm:
- No startup errors (tables are auto-created on first run)
- Logs show the scheduler starting and a pipeline run executing
- `curl http://127.0.0.1:8000/api/internal/token-status` returns JSON

Stop with `Ctrl+C` once verified.

---

## 5. systemd service for the backend

Create `/etc/systemd/system/broker-dashboard-backend.service`:

```ini
[Unit]
Description=Broker Dashboard FastAPI backend
After=network.target mariadb.service mysqld.service

[Service]
Type=simple
User=<service-user>
Group=<service-group>
WorkingDirectory=/var/www/broker-dashboard/backend
ExecStart=/var/www/broker-dashboard/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Replace `<service-user>`/`<service-group>` with whatever account other
`/var/www` apps on this server run as (e.g. `nginx`, or a dedicated app
user). That account needs read access to `/var/www/broker-dashboard/backend`.

> **Important:** Do **not** add `--workers N` (N > 1) or run this under
> multi-worker gunicorn. The app starts an in-process `BackgroundScheduler`
> (`backend/app/scheduler/jobs.py`) that runs the daily data pipeline —
> multiple workers would each run their own scheduler and duplicate pipeline
> runs. Run exactly one process; systemd's `Restart=on-failure` handles
> crash recovery.

`.env` is loaded automatically via `python-dotenv` from the backend's working
directory, so no `EnvironmentFile=` directive is required as long as
`WorkingDirectory` is set correctly above.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now broker-dashboard-backend
sudo systemctl status broker-dashboard-backend
```

---

## 6. Frontend build & deploy

From the repo root:

```bash
cd /var/www/broker-dashboard
npm install
npm run build
```

This produces `dist/` (hashed JS/CSS assets + `index.html`).

`dashboard.conf` (see step 7) sets `root /var/www/broker-dashboard;` and
expects `index.html` and `/assets/` at that root. Either:

- Point nginx's `root` directly at `/var/www/broker-dashboard/dist`
  (recommended — simplest, keeps build output separate from source/backend), **or**
- Copy `dist/*` into `/var/www/broker-dashboard` directly.

If you go with the recommended option, update `root` in `dashboard.conf` to:

```nginx
root /var/www/broker-dashboard/dist;
```

This also keeps nginx from ever serving backend source files (`backend/`,
`.env`, `.venv/`) since they live outside `dist/`.

---

## 7. nginx configuration

`dashboard.conf` (repo root) already includes proxy rules for
`/api/internal/`, `/auth/`, and `/admin/` (the latter with SPA fallback for
full-page reloads of `/admin/brokers`, `/admin/users`, etc.), plus static
asset caching and SPA fallback for `/`.

Install it:

```bash
sudo cp /var/www/broker-dashboard/dashboard.conf /etc/nginx/conf.d/broker-dashboard.conf
sudo nginx -t
sudo systemctl reload nginx
```

Before reloading, double-check:
- `server_name` (currently `192.168.101.34`) matches this server's IP/hostname
- Port `8008` doesn't collide with another vhost on this box
- `root` matches your choice from step 6 (`/var/www/broker-dashboard/dist`
  recommended)

---

## 8. SELinux & firewall

Open the public port if not already open:

```bash
sudo firewall-cmd --add-port=8008/tcp --permanent
sudo firewall-cmd --reload
```

If nginx fails to proxy to `127.0.0.1:8000` with a `502` and
`/var/log/audit/audit.log` shows `avc: denied` for nginx, allow nginx to make
outbound network connections (common on AlmaLinux with SELinux enforcing):

```bash
sudo setsebool -P httpd_can_network_connect on
```

---

## 9. Post-deploy verification

1. **Backend service running:**
   ```bash
   systemctl status broker-dashboard-backend
   curl http://127.0.0.1:8000/api/internal/token-status
   ```
   Should return JSON with token validity and `nextScheduledRun`.

2. **Pipeline ran successfully** — check the `pipeline_logs` table for a
   `success` or `partial` row from the startup run:
   ```sql
   SELECT * FROM pipeline_logs ORDER BY run_started_at DESC LIMIT 1;
   ```

3. **Frontend loads:** open `http://<server-ip>:8008` in a browser.

4. **Login & first-run admin setup:**
   - Log in as `admin@xfl.com` / `Admin@1234`
   - You'll be forced to the Profile page to change the password —
     **do this immediately**
   - Confirm the dashboard renders broker/market data

5. **Admin panel SPA routes survive a hard refresh:** navigate to
   `/admin/brokers` and `/admin/users`, then refresh the browser — both
   should reload correctly (validates the `/admin/` nginx bypass).

---

## 10. Ongoing operations

- **Backend logs:** `journalctl -u broker-dashboard-backend -f`
- **nginx logs:** `/var/log/nginx/broker-dashboard.access.log` and
  `broker-dashboard.error.log`
- **Restart backend** (after `.env` or code changes):
  ```bash
  sudo systemctl restart broker-dashboard-backend
  ```
- **Redeploy frontend** (after code changes):
  ```bash
  cd /var/www/broker-dashboard
  git pull
  npm install
  npm run build
  ```
  No nginx reload needed unless `dashboard.conf` itself changed.
- **Redeploy backend** (after code changes):
  ```bash
  cd /var/www/broker-dashboard/backend
  git pull   # if not already pulled at repo root
  source .venv/bin/activate
  pip install -r requirements.txt   # if dependencies changed
  sudo systemctl restart broker-dashboard-backend
  ```
- **Broker list changes:** `backend/app/config_data/brokers.py` and
  `src/config/brokers.ts` must be kept in sync (same broker IDs/labels, same
  order) — update both and redeploy.

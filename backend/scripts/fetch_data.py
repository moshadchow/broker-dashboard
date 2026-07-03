"""Standalone backfill script for broker execution + market trade info.

Fetches data day-by-day for a date range from the external broker API and
upserts it into MySQL (`broker_snapshots` / `market_snapshots`). Reuses the
same auth/DB stack as the FastAPI backend (`app.services.auth_service`,
`app.services.fetch_service`, `app.services.store_service`) so brokers are
read dynamically from the `brokers` table and tokens are obtained/refreshed
through the existing `token_store`-backed mechanism — no hard-coded broker
list or long-lived JWT.

Run from the `backend/` directory with its venv active (so `app.config`
picks up `backend/.env`):

    cd backend
    python scripts/fetch_data.py --from-date 2026-06-01 --to-date 2026-06-03

Credentials, DB connection, and pipeline defaults all come from `backend/.env`
(see `app/config.py` / `backend/README.md` / project CLAUDE.md "Backend:
Auto-Credential Pipeline").

Note: unlike the live pipeline (which only ever fetches "today"), this script
iterates a date range, since that's its reason to exist. If the market fetch
fails for a given day, no `market_snapshots` row is written for that day
(rather than a zeroed/`fetch_error=1` placeholder) — broker fetch failures are
still recorded per-broker with `fetch_error=1`, as in the live pipeline.
"""

import argparse
import logging
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import CredentialSet, settings  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services import auth_service, broker_service, fetch_service, oms_endpoint_service, store_service  # noqa: E402
from app.services.auth_service import NoTokenError  # noqa: E402
from app.services.external_api import ExternalAuthError, MfaRequiredError  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("fetch_data")


def get_or_refresh_token(db, credentials: CredentialSet) -> str:
    try:
        return auth_service.get_valid_access_token(db, credentials)
    except (NoTokenError, ExternalAuthError):
        return auth_service.auth(db, credentials)


def get_tokens_for_active_endpoints(db) -> dict[str, str]:
    """Log in/refresh a token per OMS endpoint that has at least one
    pipeline-enabled broker routed to it, isolating failures per endpoint."""
    endpoints = oms_endpoint_service.get_active_endpoints(db)
    active_names = {
        broker.api_endpoint or fetch_service.DEFAULT_ENDPOINT
        for broker in broker_service.list_brokers_for_pipeline(db)
    }
    tokens: dict[str, str] = {}
    for name in active_names:
        endpoint = endpoints.get(name)
        if endpoint is None or not endpoint.base_url:
            logger.warning("endpoint=%s has no base_url configured; skipping", name)
            continue
        try:
            tokens[name] = get_or_refresh_token(db, endpoint.credentials)
        except (MfaRequiredError, ExternalAuthError, NoTokenError) as exc:
            logger.warning("auth failed: endpoint=%s (%s)", name, exc)
    return tokens


def run(from_date: date, to_date: date, stock_exchange: str) -> None:
    db = SessionLocal()
    try:
        current = from_date
        while current <= to_date:
            day_str = current.strftime("%Y-%m-%d")
            logger.info("=== %s ===", day_str)

            tokens = get_tokens_for_active_endpoints(db)
            endpoints = oms_endpoint_service.get_active_endpoints(db)
            market_endpoint = endpoints.get("market")
            if market_endpoint is None:
                raise NoTokenError("no 'market' OMS endpoint configured")
            market_token = get_or_refresh_token(db, market_endpoint.credentials)

            broker_results = fetch_service.fetch_brokers(db, endpoints, tokens, day_str, day_str)
            market_data = fetch_service.fetch_market(market_endpoint, market_token, stock_exchange)
            if not broker_results:
                logger.warning("%s: no pipeline-enabled brokers found in `brokers` table", day_str)

            store_service.store_broker_results(db, broker_results, day_str, day_str)
            store_service.store_market_result(db, market_data, stock_exchange, current)

            logger.info("%s committed", day_str)
            current += timedelta(days=1)
    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--to-date", required=True, help="YYYY-MM-DD")
    parser.add_argument(
        "--stock-exchange",
        default=settings.default_stock_exchange,
        help=f"Defaults to DEFAULT_STOCK_EXCHANGE ({settings.default_stock_exchange})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    from_date = datetime.strptime(args.from_date, "%Y-%m-%d").date()
    to_date = datetime.strptime(args.to_date, "%Y-%m-%d").date()
    if from_date > to_date:
        raise ValueError("--from-date must be <= --to-date")

    try:
        run(from_date, to_date, args.stock_exchange)
    except MfaRequiredError:
        logger.exception("MFA required for service account; cannot proceed automatically")
        raise
    except ExternalAuthError:
        logger.exception("Authentication against the external API failed")
        raise
    except Exception:
        logger.exception("fetch_data run failed")
        raise


if __name__ == "__main__":
    main()

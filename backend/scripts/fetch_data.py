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
    python scripts/fetch_data.py --from-date 2026-07-05 --to-date 2026-07-06

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
from app.models.token_store import TokenStore  # noqa: E402
from app.services import auth_service, broker_service, fetch_service, oms_endpoint_service, store_service  # noqa: E402
from app.services.auth_service import NoTokenError  # noqa: E402
from app.services.external_api import ExternalAuthError, MfaRequiredError  # noqa: E402
from app.utils.time import today_local  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("fetch_data")


def get_or_refresh_token(db, credentials: CredentialSet) -> str:
    try:
        return auth_service.get_valid_access_token(db, credentials)
    except (NoTokenError, ExternalAuthError):
        return auth_service.auth(db, credentials)


def is_weekend(target_date: date) -> bool:
    return target_date.weekday() in (4, 5)


def fetch_market_with_retry(
    db,
    endpoint,
    credentials: CredentialSet,
    stock_exchange: str,
    target_date: date,
    token_cache: dict[str, str],
):
    token = token_cache.get(credentials.name)
    if token is None:
        token = get_or_refresh_token(db, credentials)
        token_cache[credentials.name] = token
    try:
        return fetch_service.fetch_market(endpoint, token, stock_exchange, target_date)
    except ExternalAuthError as exc:
        logger.warning("market token rejected (%s); refreshing and retrying once", exc)
        stored_token = db.get(TokenStore, credentials.name)
        try:
            token = auth_service.do_refresh(db, stored_token, credentials) if stored_token else auth_service.auth(db, credentials)
        except ExternalAuthError:
            token = auth_service.auth(db, credentials)
        token_cache[credentials.name] = token
        return fetch_service.fetch_market(endpoint, token, stock_exchange, target_date)


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
        logger.info("starting fetch_data backfill: from_date=%s to_date=%s stock_exchange=%s", from_date, to_date, stock_exchange)
        endpoints = oms_endpoint_service.get_active_endpoints(db)
        tokens_by_endpoint = get_tokens_for_active_endpoints(db)
        token_cache = {
            endpoints[name].credentials.name: token
            for name, token in tokens_by_endpoint.items()
            if name in endpoints
        }
        current = from_date
        total_fetched = 0
        total_inserted = 0
        total_duplicates = 0
        total_errors = 0

        while current <= to_date:
            day_str = current.strftime("%Y-%m-%d")
            if is_weekend(current):
                logger.info("Skipping weekend date: %s", day_str)
                current += timedelta(days=1)
                continue

            logger.info("processing date=%s", day_str)

            try:
                market_endpoint = endpoints.get("market")
                if market_endpoint is None:
                    raise NoTokenError("no 'market' OMS endpoint configured")

                broker_results = fetch_service.fetch_brokers(db, endpoints, tokens_by_endpoint, day_str, day_str)
                market_data = fetch_market_with_retry(
                    db,
                    market_endpoint,
                    market_endpoint.credentials,
                    stock_exchange,
                    current,
                    token_cache,
                )
                if not broker_results:
                    logger.warning("%s: no pipeline-enabled brokers found in `brokers` table", day_str)
                if market_data is None:
                    raise RuntimeError(f"market data fetch failed for {day_str}")

                store_service.store_broker_results(db, broker_results, day_str, day_str)
                stats = store_service.store_market_result(db, market_data, stock_exchange, current, skip_existing=True)

                total_fetched += stats["fetched"]
                total_inserted += stats["inserted"]
                total_duplicates += stats["duplicates"]
                logger.info(
                    "%s complete: fetched=%s inserted=%s duplicates_skipped=%s",
                    day_str,
                    stats["fetched"],
                    stats["inserted"],
                    stats["duplicates"],
                )
            except Exception:
                total_errors += 1
                logger.exception("%s failed; continuing with next date", day_str)
            current += timedelta(days=1)

        logger.info(
            "fetch_data backfill finished: from_date=%s to_date=%s fetched=%s inserted=%s duplicates_skipped=%s errors=%s",
            from_date,
            to_date,
            total_fetched,
            total_inserted,
            total_duplicates,
            total_errors,
        )
    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-date", help="YYYY-MM-DD; defaults to today when omitted")
    parser.add_argument("--to-date", help="YYYY-MM-DD; defaults to --from-date or today")
    parser.add_argument(
        "--stock-exchange",
        default=settings.default_stock_exchange,
        help=f"Defaults to DEFAULT_STOCK_EXCHANGE ({settings.default_stock_exchange})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.to_date and not args.from_date:
        raise ValueError("--from-date is required when --to-date is supplied")

    from_date = datetime.strptime(args.from_date, "%Y-%m-%d").date() if args.from_date else today_local()
    to_date = datetime.strptime(args.to_date, "%Y-%m-%d").date() if args.to_date else from_date
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

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
    python scripts/fetch_data.py --from-date 2026-07-05 --to-date 2026-07-06 --stock-exchange DSE
    python scripts/fetch_data.py --from-date 2026-07-05 --to-date 2026-07-06 --stock-exchange CSE

Credentials, DB connection, and pipeline defaults all come from `backend/.env`
(see `app/config.py` / `backend/README.md` "Backend:
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
from app.config_data.exchanges import EXCHANGE_CONFIG, SUPPORTED_EXCHANGES, validate_exchange  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.token_store import TokenStore  # noqa: E402
from app.services import auth_service, broker_service, fetch_service, oms_endpoint_service, store_service  # noqa: E402
from app.services.auth_service import NoTokenError  # noqa: E402
from app.services.external_api import ExternalAuthError, MfaRequiredError  # noqa: E402
from app.utils.time import today_local  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("fetch_data")

WEEKDAY_NAMES = {
    "monday": 0,
    "mon": 0,
    "tuesday": 1,
    "tue": 1,
    "wednesday": 2,
    "wed": 2,
    "thursday": 3,
    "thu": 3,
    "friday": 4,
    "fri": 4,
    "saturday": 5,
    "sat": 5,
    "sunday": 6,
    "sun": 6,
}


def get_or_refresh_token(db, credentials: CredentialSet) -> str:
    try:
        return auth_service.get_valid_access_token(db, credentials)
    except (NoTokenError, ExternalAuthError):
        return auth_service.auth(db, credentials)


def parse_excluded_weekdays(value: str) -> set[int]:
    weekdays: set[int] = set()
    invalid: list[str] = []

    for raw_part in value.split(","):
        part = raw_part.strip().lower()
        if not part:
            continue

        if part.isdigit():
            iso_weekday = int(part)
            if 1 <= iso_weekday <= 7:
                weekdays.add(iso_weekday - 1)
            else:
                invalid.append(raw_part.strip())
            continue

        weekday = WEEKDAY_NAMES.get(part)
        if weekday is None:
            invalid.append(raw_part.strip())
        else:
            weekdays.add(weekday)

    if invalid:
        raise ValueError(f"invalid excluded_weekdays value(s): {', '.join(invalid)}")
    if not weekdays:
        raise ValueError("excluded_weekdays must include at least one weekday")

    return weekdays


def is_excluded_weekday(target_date: date, excluded_weekdays: set[int]) -> bool:
    return target_date.weekday() in excluded_weekdays


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


def process_exchange_for_date(
    db,
    target_date: date,
    day_str: str,
    stock_exchange: str,
    endpoints: dict,
    tokens_by_endpoint: dict[str, str],
    token_cache: dict[str, str],
) -> dict[str, int]:
    """Process broker + market data for a single exchange on a single date.

    Returns a stats dict with keys: broker_ok, broker_failed, market_fetched,
    market_inserted, market_duplicates, error (0 or 1).
    """
    stats = {
        "broker_ok": 0,
        "broker_failed": 0,
        "market_fetched": 0,
        "market_inserted": 0,
        "market_duplicates": 0,
        "error": 0,
    }

    try:
        market_endpoint = endpoints.get("market")
        if market_endpoint is None:
            raise NoTokenError("no 'market' OMS endpoint configured")

        broker_results = fetch_service.fetch_brokers(
            db, endpoints, tokens_by_endpoint, day_str, day_str, stock_exchange
        )
        market_data = fetch_market_with_retry(
            db,
            market_endpoint,
            market_endpoint.credentials,
            stock_exchange,
            target_date,
            token_cache,
        )

        if not broker_results:
            logger.warning("%s [%s]: no pipeline-enabled brokers found", day_str, stock_exchange)

        store_service.store_broker_results(db, broker_results, day_str, day_str, stock_exchange)
        stats["broker_ok"] = sum(1 for r in broker_results if not r["fetch_error"])
        stats["broker_failed"] = sum(1 for r in broker_results if r["fetch_error"])

        if market_data is not None:
            market_stats = store_service.store_market_result(
                db, market_data, stock_exchange, target_date, skip_existing=True
            )
            stats["market_fetched"] = market_stats["fetched"]
            stats["market_inserted"] = market_stats["inserted"]
            stats["market_duplicates"] = market_stats["duplicates"]
        else:
            logger.warning("%s [%s]: market data fetch failed; no snapshot written", day_str, stock_exchange)

    except Exception:
        stats["error"] = 1
        logger.exception("%s [%s]: failed; continuing with next exchange/date", day_str, stock_exchange)

    return stats


def run(from_date: date, to_date: date, exchanges: list[str]) -> None:
    db = SessionLocal()
    try:
        exchange_label = ",".join(exchanges)
        logger.info(
            "Starting Historical Backfill\n"
            "  From Date  : %s\n"
            "  To Date    : %s\n"
            "  Exchange   : %s",
            from_date, to_date, exchange_label,
        )

        excluded_weekdays = parse_excluded_weekdays(settings.excluded_weekdays)
        endpoints = oms_endpoint_service.get_active_endpoints(db)
        tokens_by_endpoint = get_tokens_for_active_endpoints(db)
        token_cache = {
            endpoints[name].credentials.name: token
            for name, token in tokens_by_endpoint.items()
            if name in endpoints
        }

        total_dates_processed = 0
        total_broker_ok = 0
        total_broker_failed = 0
        total_market_inserted = 0
        total_market_duplicates = 0
        total_errors = 0

        current = from_date
        while current <= to_date:
            day_str = current.strftime("%Y-%m-%d")
            if is_excluded_weekday(current, excluded_weekdays):
                logger.info("Skipping non-working day: %s (%s)", day_str, current.strftime("%A"))
                current += timedelta(days=1)
                continue

            total_dates_processed += 1

            for stock_exchange in exchanges:
                logger.info("Processing Date: %s | Exchange: %s", day_str, stock_exchange)
                logger.info("  Fetching Broker Summary...")
                logger.info("  Fetching Market Data...")

                stats = process_exchange_for_date(
                    db, current, day_str, stock_exchange,
                    endpoints, tokens_by_endpoint, token_cache,
                )

                total_broker_ok += stats["broker_ok"]
                total_broker_failed += stats["broker_failed"]
                total_market_inserted += stats["market_inserted"]
                total_market_duplicates += stats["market_duplicates"]
                total_errors += stats["error"]

                if stats["error"]:
                    logger.info("  Status: %s [%s] - FAILED", day_str, stock_exchange)
                else:
                    logger.info("  Broker Snapshot Saved: ok=%d failed=%d", stats["broker_ok"], stats["broker_failed"])
                    logger.info("  Market Snapshot Saved: inserted=%d duplicates=%d", stats["market_inserted"], stats["market_duplicates"])
                    logger.info("  Status: %s [%s] - SUCCESS", day_str, stock_exchange)

            current += timedelta(days=1)

        logger.info(
            "\nBackfill Completed\n"
            "  Dates Processed   : %d\n"
            "  Total Exchanges   : %d\n"
            "  Broker Records    : %d (ok=%d, failed=%d)\n"
            "  Market Records    : %d (duplicates=%d)\n"
            "  Errors            : %d",
            total_dates_processed,
            len(exchanges),
            total_broker_ok + total_broker_failed,
            total_broker_ok,
            total_broker_failed,
            total_market_inserted,
            total_market_duplicates,
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
        default=None,
        help=f"Stock exchange: {', '.join(SUPPORTED_EXCHANGES)}. "
             f"Omit to process all supported exchanges. "
             f"Defaults to processing all exchanges.",
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

    if args.stock_exchange:
        try:
            exchange = validate_exchange(args.stock_exchange)
        except ValueError as exc:
            logger.error("Validation error: %s", exc)
            raise
        exchanges = [exchange]
    else:
        exchanges = list(SUPPORTED_EXCHANGES)

    try:
        run(from_date, to_date, exchanges)
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

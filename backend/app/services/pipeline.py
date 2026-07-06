import logging

from app.config import settings
from app.db.session import SessionLocal
from app.models.token_store import TokenStore
from app.services import auth_service, broker_service, fetch_service, oms_endpoint_service, store_service
from app.services.external_api import ExternalAuthError, MfaRequiredError
from app.utils.time import now_utc, today_local

logger = logging.getLogger(__name__)


def _get_token(db, credentials):
    try:
        return auth_service.get_valid_access_token(db, credentials)
    except auth_service.NoTokenError:
        return auth_service.auth(db, credentials)
    except ExternalAuthError as exc:
        logger.warning("token refresh rejected (%s); falling back to fresh login", exc)
        return auth_service.auth(db, credentials)


def _fetch_market_with_retry(db, endpoint, credentials, stock_exchange, target_date):
    token = _get_token(db, credentials)
    try:
        return fetch_service.fetch_market(endpoint, token, stock_exchange, target_date)
    except ExternalAuthError as exc:
        logger.warning("market token rejected (%s); refreshing and retrying once", exc)
        stored_token = db.get(TokenStore, credentials.name)
        try:
            token = auth_service.do_refresh(db, stored_token, credentials) if stored_token else auth_service.auth(db, credentials)
        except ExternalAuthError:
            token = auth_service.auth(db, credentials)
        return fetch_service.fetch_market(endpoint, token, stock_exchange, target_date)


def _active_endpoint_names(db) -> set[str]:
    """Endpoint names with at least one pipeline-enabled broker routed to them."""
    return {
        broker.api_endpoint or fetch_service.DEFAULT_ENDPOINT
        for broker in broker_service.list_brokers_for_pipeline(db)
    }


def _acquire_tokens(db, endpoint_names: set[str]) -> dict[str, str]:
    """Log in/refresh a token per endpoint, isolating failures so one bad
    endpoint (e.g. PUJI down) doesn't block tokens for the others."""
    endpoints = oms_endpoint_service.get_active_endpoints(db)
    tokens: dict[str, str] = {}
    for name in endpoint_names:
        endpoint = endpoints.get(name)
        if endpoint is None or not endpoint.base_url:
            logger.warning("endpoint=%s has no base_url configured; skipping", name)
            continue
        try:
            tokens[name] = _get_token(db, endpoint.credentials)
            logger.info("auth succeeded: endpoint=%s", name)
        except (MfaRequiredError, ExternalAuthError, auth_service.NoTokenError) as exc:
            logger.warning("auth failed: endpoint=%s (%s)", name, exc)
    return tokens


def _retry_failed_endpoints(
    db, broker_results: list[dict], tokens: dict[str, str], from_date: str, to_date: str
) -> list[dict]:
    """For each endpoint where every broker fetch failed, refresh/re-login
    that endpoint's token once and retry just that endpoint's brokers.

    Returns broker_results with only the retried endpoints' rows replaced;
    endpoints that already succeeded are left untouched (not re-fetched).
    """
    endpoints = oms_endpoint_service.get_active_endpoints(db)
    brokers_by_endpoint: dict[str, list] = {}
    for broker in broker_service.list_brokers_for_pipeline(db):
        brokers_by_endpoint.setdefault(broker.api_endpoint or fetch_service.DEFAULT_ENDPOINT, []).append(broker)

    results_by_id = {r["broker"]["id"]: r for r in broker_results}
    retry_endpoint_names = set()

    for name, brokers in brokers_by_endpoint.items():
        endpoint_results = [results_by_id[b.external_api_id] for b in brokers if b.external_api_id in results_by_id]
        if not endpoint_results or not all(r["fetch_error"] for r in endpoint_results):
            continue

        endpoint = endpoints.get(name)
        if endpoint is None or not endpoint.base_url:
            continue

        logger.info("all broker fetches failed for endpoint=%s; refreshing token and retrying", name)
        token = db.get(TokenStore, endpoint.credentials.name)
        retried_token = None
        try:
            if token is not None:
                retried_token = auth_service.do_refresh(db, token, endpoint.credentials)
            else:
                retried_token = auth_service.auth(db, endpoint.credentials)
        except ExternalAuthError as exc:
            logger.warning("token refresh rejected for endpoint=%s (%s); falling back to fresh login", name, exc)
            try:
                retried_token = auth_service.auth(db, endpoint.credentials)
            except ExternalAuthError as exc2:
                logger.warning("fresh login also failed for endpoint=%s (%s); skipping retry", name, exc2)

        if retried_token is None:
            continue

        tokens[name] = retried_token
        retry_endpoint_names.add(name)

    if not retry_endpoint_names:
        return broker_results

    retry_brokers = [b for name in retry_endpoint_names for b in brokers_by_endpoint[name]]
    retry_endpoints = {name: endpoints[name] for name in retry_endpoint_names}
    retried_results = fetch_service.fetch_brokers_subset(
        retry_brokers, retry_endpoints, tokens, from_date, to_date
    )
    retried_by_id = {r["broker"]["id"]: r for r in retried_results}

    return [retried_by_id.get(r["broker"]["id"], r) for r in broker_results]


def run_pipeline() -> None:
    started_at = now_utc()
    db = SessionLocal()
    try:
        endpoints = oms_endpoint_service.get_active_endpoints(db)
        active_endpoint_names = _active_endpoint_names(db)
        tokens = _acquire_tokens(db, active_endpoint_names)

        market_creds = oms_endpoint_service.get_endpoint_credentials(db, "market")
        if market_creds is None:
            raise auth_service.NoTokenError("no 'market' OMS endpoint configured")
        market_endpoint = endpoints.get("market") or endpoints.get("primary")
        if market_endpoint is None:
            raise auth_service.NoTokenError("no 'market' or 'primary' OMS endpoint configured")

        today = today_local()
        today_iso = today.isoformat()

        broker_results = fetch_service.fetch_brokers(db, endpoints, tokens, today_iso, today_iso)
        market_data = _fetch_market_with_retry(
            db, market_endpoint, market_creds, settings.default_stock_exchange, today
        )

        # If every broker on a given endpoint failed, that endpoint's token may
        # have expired mid-cycle - refresh and retry just that endpoint once.
        if broker_results and any(r["fetch_error"] for r in broker_results):
            broker_results = _retry_failed_endpoints(db, broker_results, tokens, today_iso, today_iso)

        store_service.store_broker_results(db, broker_results, today_iso, today_iso)
        store_service.store_market_result(db, market_data, settings.default_stock_exchange, today)

        brokers_ok = sum(1 for r in broker_results if not r["fetch_error"])
        brokers_failed = len(broker_results) - brokers_ok
        market_ok = market_data is not None

        if brokers_failed == 0 and market_ok:
            status = "success"
        elif brokers_ok > 0 or market_ok:
            status = "partial"
        else:
            status = "failed"

        store_service.log_pipeline_run(
            db, started_at, now_utc(), status, brokers_ok, brokers_failed, market_ok
        )
        logger.info(
            "pipeline run finished: status=%s brokers_ok=%d brokers_failed=%d market_ok=%s endpoints=%s",
            status, brokers_ok, brokers_failed, market_ok, sorted(active_endpoint_names),
        )

    except MfaRequiredError as exc:
        logger.error("MFA required for service account, skipping cycle: %s", exc)
        store_service.log_pipeline_run(db, started_at, now_utc(), "failed", 0, 0, False, str(exc))
    except (ExternalAuthError, auth_service.NoTokenError) as exc:
        logger.error("auth/refresh failed, skipping cycle: %s", exc)
        store_service.log_pipeline_run(db, started_at, now_utc(), "failed", 0, 0, False, str(exc))
    except Exception as exc:
        logger.exception("pipeline run failed")
        store_service.log_pipeline_run(db, started_at, now_utc(), "failed", 0, 0, False, str(exc))
    finally:
        db.close()

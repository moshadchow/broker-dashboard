import logging

from app.config import settings
from app.db.session import SessionLocal
from app.models.token_store import TokenStore
from app.services import auth_service, fetch_service, store_service
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


def run_pipeline() -> None:
    started_at = now_utc()
    db = SessionLocal()
    try:
        broker_creds = settings.broker_summary_credentials
        market_creds = settings.market_credentials

        broker_token = _get_token(db, broker_creds)
        market_token = _get_token(db, market_creds)

        today = today_local()
        today_iso = today.isoformat()

        broker_results, market_data = fetch_service.fetch_all(
            db, broker_token, market_token, today_iso, today_iso, settings.default_stock_exchange
        )

        # If every broker failed, the access token may have expired mid-cycle - refresh and retry once.
        if broker_results and all(r["fetch_error"] for r in broker_results):
            logger.info("all broker fetches failed; refreshing token and retrying")
            token = db.get(TokenStore, broker_creds.name)
            if token is not None:
                retried_token = None
                try:
                    retried_token = auth_service.do_refresh(db, token, broker_creds)
                except ExternalAuthError as exc:
                    logger.warning("token refresh rejected (%s); falling back to fresh login", exc)
                    try:
                        retried_token = auth_service.auth(db, broker_creds)
                    except ExternalAuthError as exc2:
                        logger.warning("fresh login also failed (%s); skipping retry", exc2)

                if retried_token is not None:
                    broker_token = retried_token
                    broker_results, market_data = fetch_service.fetch_all(
                        db, broker_token, market_token, today_iso, today_iso, settings.default_stock_exchange
                    )

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
            "pipeline run finished: status=%s brokers_ok=%d brokers_failed=%d market_ok=%s",
            status, brokers_ok, brokers_failed, market_ok,
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

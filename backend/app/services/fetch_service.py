import logging
from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.config import OmsEndpoint
from app.services import broker_service, external_api

logger = logging.getLogger(__name__)

DEFAULT_ENDPOINT = "primary"

ZERO_BROKER_DATA = {
    "totalExecutionReport": 0,
    "totalTrade": 0,
    "buyTrade": 0,
    "sellTrade": 0,
    "totalValue": 0,
    "buyValue": 0,
    "sellValue": 0,
}


def _fetch_broker_list(
    brokers: list,
    endpoints: dict[str, OmsEndpoint],
    tokens: dict[str, str],
    from_date: str,
    to_date: str,
    stock_exchange: str = "DSE",
) -> list[dict]:
    """Fetch broker summaries for the given brokers, grouped by the OMS
    endpoint each broker is routed to (broker.api_endpoint).

    Each broker is fetched independently and failures are isolated per
    broker: a failure or missing token for one endpoint does not prevent
    brokers on other endpoints from being fetched.

    Returns a list of {"broker": {...}, "data": dict | None, "fetch_error": bool}.
    """
    by_endpoint: dict[str, list] = defaultdict(list)
    for broker in brokers:
        by_endpoint[broker.api_endpoint or DEFAULT_ENDPOINT].append(broker)

    broker_results = []
    for endpoint_name, endpoint_brokers in by_endpoint.items():
        endpoint = endpoints.get(endpoint_name)
        token = tokens.get(endpoint_name)

        for broker in endpoint_brokers:
            broker_dict = {"id": broker.external_api_id, "label": broker.broker_label}

            if endpoint is None or token is None:
                logger.warning(
                    "no token for endpoint=%s; skipping broker %s (%s)",
                    endpoint_name, broker.external_api_id, broker.broker_label,
                )
                broker_results.append({"broker": broker_dict, "data": None, "fetch_error": True})
                continue

            try:
                data = external_api.fetch_broker_summary(
                    endpoint.base_url, token, broker.external_api_id, from_date, to_date, stock_exchange
                )
                broker_results.append({"broker": broker_dict, "data": data, "fetch_error": False})
            except Exception:
                logger.warning(
                    "broker fetch failed: endpoint=%s broker=%s (%s)",
                    endpoint_name, broker.external_api_id, broker.broker_label, exc_info=True,
                )
                broker_results.append({"broker": broker_dict, "data": None, "fetch_error": True})

    return broker_results


def fetch_brokers(
    db: Session,
    endpoints: dict[str, OmsEndpoint],
    tokens: dict[str, str],
    from_date: str,
    to_date: str,
    stock_exchange: str = "DSE",
) -> list[dict]:
    """Fetch broker summaries for all pipeline-enabled brokers (see
    `_fetch_broker_list` for the per-endpoint fetch/error-isolation logic)."""
    brokers = broker_service.list_brokers_for_pipeline(db)
    return _fetch_broker_list(brokers, endpoints, tokens, from_date, to_date, stock_exchange)


def fetch_brokers_subset(
    brokers: list,
    endpoints: dict[str, OmsEndpoint],
    tokens: dict[str, str],
    from_date: str,
    to_date: str,
    stock_exchange: str = "DSE",
) -> list[dict]:
    """Fetch broker summaries for an explicit broker list (e.g. retrying only
    the brokers on endpoints whose token was just refreshed)."""
    return _fetch_broker_list(brokers, endpoints, tokens, from_date, to_date, stock_exchange)


def fetch_market(
    endpoint: OmsEndpoint,
    token: str,
    stock_exchange: str,
    target_date: date | None = None,
) -> list[dict] | None:
    """Fetch market share price history from the given endpoint. Returns None on failure."""
    try:
        return external_api.fetch_market_trade_info(endpoint.base_url, token, stock_exchange, target_date)
    except external_api.ExternalAuthError:
        raise
    except Exception:
        logger.warning("market fetch failed for %s", stock_exchange, exc_info=True)
        return None

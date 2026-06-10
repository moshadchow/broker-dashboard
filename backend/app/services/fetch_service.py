import logging

from app.config_data.brokers import BROKERS
from app.services import external_api

logger = logging.getLogger(__name__)

ZERO_BROKER_DATA = {
    "totalExecutionReport": 0,
    "totalTrade": 0,
    "buyTrade": 0,
    "sellTrade": 0,
    "totalValue": 0,
    "buyValue": 0,
    "sellValue": 0,
}


def fetch_all(access_token: str, from_date: str, to_date: str, stock_exchange: str):
    """Fetch broker summaries for all configured brokers and market trade info.

    Returns (broker_results, market_data). Each broker_result is
    {"broker": {...}, "data": dict | None, "fetch_error": bool}.
    market_data is a dict or None if the market fetch failed.
    """
    broker_results = []
    for broker in BROKERS:
        try:
            data = external_api.fetch_broker_summary(access_token, broker["id"], from_date, to_date)
            broker_results.append({"broker": broker, "data": data, "fetch_error": False})
        except Exception:
            logger.warning("broker fetch failed: %s (%s)", broker["id"], broker["label"], exc_info=True)
            broker_results.append({"broker": broker, "data": None, "fetch_error": True})

    try:
        market_data = external_api.fetch_market_trade_info(access_token, stock_exchange)
    except Exception:
        logger.warning("market fetch failed for %s", stock_exchange, exc_info=True)
        market_data = None

    return broker_results, market_data

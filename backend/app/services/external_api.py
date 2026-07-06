import logging
from datetime import date, datetime, time

import httpx

from app.utils.time import app_tz, today_local

REQUEST_TIMEOUT = 30
SHARE_PRICE_SYMBOL = "DSEX"
SHARE_PRICE_MARKET_TYPE = "Public"
SHARE_PRICE_RESOLUTION = "1D"
SHARE_PRICE_PAGE_SIZE = 100000000
SHARE_PRICE_PAGE = 1
SHARE_PRICE_SORT_DIRECTION = "Asc"
SHARE_PRICE_ARRAY_FIELDS = (
    "times",
    "closes",
    "ltps",
    "ycps",
    "opens",
    "highs",
    "lows",
    "settlementPrices",
    "volumes",
    "trades",
    "values",
    "changes",
    "changePercentages",
)

logger = logging.getLogger(__name__)


class ExternalAuthError(Exception):
    """Raised when login or token refresh against the external API fails."""


class ExternalApiError(Exception):
    """Raised when a data-fetch call against the external API fails."""


class MfaRequiredError(ExternalAuthError):
    """Raised when the external API requires MFA for the service account."""


def login(base_url: str, username: str, password: str, device_id: str, app_type: int) -> dict:
    resp = httpx.post(
        f"{base_url}/api/login",
        json={
            "loginId": username,
            "password": password,
            "deviceId": device_id,
            "mfaKey": "",
            "mfaCode": "",
            "appType": app_type,
        },
        timeout=REQUEST_TIMEOUT,
    )
    try:
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise ExternalAuthError(f"Login failed: {exc}") from exc
    body = resp.json()
    data = body.get("data") or {}
    if not body.get("success") or not data.get("success"):
        raise ExternalAuthError(data.get("errorMessage") or body.get("errorMessage") or "Login failed")
    if data.get("isMfaRequired"):
        raise MfaRequiredError("MFA required for service account; cannot proceed automatically")
    return data


def refresh_token(base_url: str, access_token: str, refresh_token_value: str, device_id: str) -> dict:
    resp = httpx.post(
        f"{base_url}/api/login/refresh-token",
        json={
            "accessToken": access_token,
            "refreshToken": refresh_token_value,
            "deviceId": device_id,
        },
        timeout=REQUEST_TIMEOUT,
    )
    try:
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise ExternalAuthError(f"Token refresh failed: {exc}") from exc
    body = resp.json()
    data = body.get("data") or {}
    if not body.get("success") or not data.get("success"):
        raise ExternalAuthError(data.get("errorMessage") or body.get("errorMessage") or "Token refresh failed")
    return data


def fetch_broker_summary(base_url: str, access_token: str, broker_id: str, from_date: str, to_date: str) -> dict:
    resp = httpx.get(
        f"{base_url}/api/broker-summary/orders-execution",
        params={"fromDate": from_date, "toDate": to_date},
        headers={"Authorization": f"Bearer {access_token}", "X-BrokerId": broker_id},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    if not body.get("success"):
        raise ExternalApiError(f"Broker {broker_id}: success=false")
    return body["data"]


def _timestamp_for_date(target_date: date) -> int:
    return int(datetime.combine(target_date, time.min, tzinfo=app_tz()).timestamp())


def _response_data(body: dict) -> dict:
    if "success" in body:
        if not body.get("success"):
            raise ExternalApiError("Market share price history: success=false")
        return body.get("data") or {}
    return body


def _normalize_share_price_history(data: dict, stock_exchange: str) -> list[dict]:
    if not isinstance(data, dict):
        logger.warning("Malformed market share price history response: data is not an object")
        return []

    arrays = {}
    for field in SHARE_PRICE_ARRAY_FIELDS:
        value = data.get(field)
        if value is None:
            logger.warning("Malformed market share price history response: missing %s", field)
            return []
        if not isinstance(value, list):
            logger.warning("Malformed market share price history response: %s is not an array", field)
            return []
        arrays[field] = value

    lengths = {len(value) for value in arrays.values()}
    if len(lengths) != 1:
        logger.warning("Malformed market share price history response: unequal array lengths")
        return []

    length = lengths.pop()
    if length == 0:
        logger.info("Market share price history response is empty for %s", stock_exchange)
        return []

    rows = []
    for index in range(length):
        timestamp = arrays["times"][index]
        try:
            timestamp_int = int(timestamp)
            snapshot_date = datetime.fromtimestamp(timestamp_int, app_tz()).date()
            rows.append(
                {
                    "stock_exchange": stock_exchange,
                    "snapshot_date": snapshot_date,
                    "times": timestamp_int,
                    "closes": arrays["closes"][index],
                    "ltps": arrays["ltps"][index],
                    "ycps": arrays["ycps"][index],
                    "opens": arrays["opens"][index],
                    "highs": arrays["highs"][index],
                    "lows": arrays["lows"][index],
                    "settlement_prices": arrays["settlementPrices"][index],
                    "volumes": arrays["volumes"][index],
                    "trades": arrays["trades"][index],
                    "values": arrays["values"][index],
                    "changes": arrays["changes"][index],
                    "change_percentages": arrays["changePercentages"][index],
                }
            )
        except (TypeError, ValueError, OSError):
            logger.warning("Skipping malformed market share price history row at index=%s", index, exc_info=True)

    return rows


def fetch_market_trade_info(
    base_url: str,
    access_token: str,
    stock_exchange: str,
    target_date: date | None = None,
) -> list[dict]:
    target_date = target_date or today_local()
    target_timestamp = _timestamp_for_date(target_date)
    resp = httpx.get(
        f"{base_url}/api/share-price-histories/{stock_exchange}",
        params={
            "Filter.Symbol": SHARE_PRICE_SYMBOL,
            "Filter.marketType": SHARE_PRICE_MARKET_TYPE,
            "Filter.resolution": SHARE_PRICE_RESOLUTION,
            "Filter.from": target_timestamp,
            "Filter.to": target_timestamp,
            "Paging.size": SHARE_PRICE_PAGE_SIZE,
            "Paging.page": SHARE_PRICE_PAGE,
            "Paging.sortDirection": SHARE_PRICE_SORT_DIRECTION,
        },
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=REQUEST_TIMEOUT,
    )
    try:
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            raise ExternalAuthError("Market share price history unauthorized") from exc
        raise
    body = resp.json()
    return _normalize_share_price_history(_response_data(body), stock_exchange)

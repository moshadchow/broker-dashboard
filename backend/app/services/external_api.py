import httpx

from app.config import settings

REQUEST_TIMEOUT = 30


class ExternalAuthError(Exception):
    """Raised when login or token refresh against the external API fails."""


class ExternalApiError(Exception):
    """Raised when a data-fetch call against the external API fails."""


class MfaRequiredError(ExternalAuthError):
    """Raised when the external API requires MFA for the service account."""


def login(username: str, password: str, device_id: str) -> dict:
    resp = httpx.post(
        f"{settings.external_api_base_url}/api/login",
        json={
            "loginId": username,
            "password": password,
            "deviceId": device_id,
            "mfaKey": "",
            "mfaCode": "",
            "appType": settings.app_type,
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    data = body.get("data") or {}
    if not body.get("success") or not data.get("success"):
        raise ExternalAuthError(data.get("errorMessage") or body.get("errorMessage") or "Login failed")
    if data.get("isMfaRequired"):
        raise MfaRequiredError("MFA required for service account; cannot proceed automatically")
    return data


def refresh_token(access_token: str, refresh_token_value: str, device_id: str) -> dict:
    resp = httpx.post(
        f"{settings.external_api_base_url}/api/login/refresh-token",
        json={
            "accessToken": access_token,
            "refreshToken": refresh_token_value,
            "deviceId": device_id,
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    data = body.get("data") or {}
    if not body.get("success") or not data.get("success"):
        raise ExternalAuthError(data.get("errorMessage") or body.get("errorMessage") or "Token refresh failed")
    return data


def fetch_broker_summary(access_token: str, broker_id: str, from_date: str, to_date: str) -> dict:
    resp = httpx.get(
        f"{settings.external_api_base_url}/api/broker-summary/orders-execution",
        params={"fromDate": from_date, "toDate": to_date},
        headers={"Authorization": f"Bearer {access_token}", "X-BrokerId": broker_id},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    if not body.get("success"):
        raise ExternalApiError(f"Broker {broker_id}: success=false")
    return body["data"]


def fetch_market_trade_info(access_token: str, stock_exchange: str) -> dict:
    resp = httpx.get(
        f"{settings.external_api_base_url}/api/indexes/{stock_exchange}/market-trade-info",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    if not body.get("success"):
        raise ExternalApiError("Market trade info: success=false")
    return body["data"]

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.config import settings


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def app_tz():
    try:
        return ZoneInfo(settings.app_timezone)
    except ZoneInfoNotFoundError:
        if settings.app_timezone == "Asia/Dhaka":
            return timezone(timedelta(hours=6), name="Asia/Dhaka")
        raise


def today_local() -> date:
    return datetime.now(app_tz()).date()


def parse_utc_iso(value: str) -> datetime:
    """Parse an ISO datetime string (e.g. accessTokenExpiryDateTimeUtc) into a tz-aware UTC datetime."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def is_expiring_soon(expires_at: datetime, skew_minutes: int) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= now_utc() + timedelta(minutes=skew_minutes)

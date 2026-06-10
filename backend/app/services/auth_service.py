from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.orm import Session

from app.config import settings
from app.models.token_store import TokenStore
from app.services import external_api
from app.utils.time import is_expiring_soon, parse_utc_iso


class NoTokenError(Exception):
    """Raised when no token exists in token_store yet."""


def upsert_token(db: Session, data: dict) -> None:
    expires_at = parse_utc_iso(data["accessTokenExpiryDateTimeUtc"])
    stmt = mysql_insert(TokenStore).values(
        id=1,
        access_token=data["accessToken"],
        refresh_token=data["refreshToken"],
        expires_at=expires_at,
        user_id=data.get("userId"),
    )
    stmt = stmt.on_duplicate_key_update(
        access_token=stmt.inserted.access_token,
        refresh_token=stmt.inserted.refresh_token,
        expires_at=stmt.inserted.expires_at,
        user_id=stmt.inserted.user_id,
    )
    db.execute(stmt)
    db.commit()


def auth(db: Session) -> str:
    """Full login using .env service-account credentials. Raises MfaRequiredError if MFA is required."""
    data = external_api.login(
        settings.auto_auth_username,
        settings.auto_auth_password,
        settings.auto_auth_device_id,
    )
    upsert_token(db, data)
    return data["accessToken"]


def do_refresh(db: Session, token: TokenStore) -> str:
    data = external_api.refresh_token(
        token.access_token,
        token.refresh_token,
        settings.auto_auth_device_id,
    )
    upsert_token(db, data)
    return data["accessToken"]


def get_valid_access_token(db: Session) -> str:
    """Returns a usable access token, refreshing if it is expired or expiring soon."""
    token = db.get(TokenStore, 1)
    if token is None:
        raise NoTokenError("No token in store; run auth() first")

    if is_expiring_soon(token.expires_at, settings.token_refresh_skew_minutes):
        return do_refresh(db, token)

    return token.access_token

import uuid
from datetime import timedelta

from jose import JWTError, jwt

from app.config import settings
from app.models.user import User
from app.utils.time import now_utc


class InvalidTokenError(Exception):
    pass


def _create_token(user: User, token_type: str, expires_delta: timedelta) -> tuple[str, str]:
    jti = str(uuid.uuid4())
    expires_at = now_utc() + expires_delta
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "type": token_type,
        "jti": jti,
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, jti


def create_access_token(user: User) -> str:
    token, _ = _create_token(
        user, "access", timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    return token


def create_refresh_token(user: User) -> str:
    token, _ = _create_token(
        user, "refresh", timedelta(days=settings.jwt_refresh_token_expire_days)
    )
    return token


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise InvalidTokenError(str(exc)) from exc

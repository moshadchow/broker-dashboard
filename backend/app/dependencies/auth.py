from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.token_blacklist import TokenBlacklist
from app.models.user import User
from app.services.jwt_service import InvalidTokenError, decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    try:
        payload = decode_token(token)
    except InvalidTokenError as exc:
        raise CREDENTIALS_EXCEPTION from exc

    if payload.get("type") != "access":
        raise CREDENTIALS_EXCEPTION

    jti = payload.get("jti")
    if jti and db.scalar(select(TokenBlacklist).where(TokenBlacklist.jti == jti)) is not None:
        raise CREDENTIALS_EXCEPTION

    user_id = payload.get("sub")
    if user_id is None:
        raise CREDENTIALS_EXCEPTION

    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise CREDENTIALS_EXCEPTION

    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user

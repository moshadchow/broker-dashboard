from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.broker import Broker
from app.models.user import User
from app.services.password_service import hash_password

DEFAULT_ADMIN_EMAIL = "admin@xfl.com"
DEFAULT_ADMIN_PASSWORD = "Admin@1234"


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def get_user(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id)).all())


def _validate_broker_id(db: Session, broker_id: str | None) -> None:
    if broker_id is not None and db.get(Broker, broker_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown broker_id")


def create_user(
    db: Session, email: str, password: str, role: str, broker_id: str | None
) -> User:
    if get_user_by_email(db, email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    _validate_broker_id(db, broker_id)

    user = User(
        email=email,
        password_hash=hash_password(password),
        role=role,
        broker_id=broker_id,
        is_active=True,
        must_change_password=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(
    db: Session,
    user_id: int,
    email: str | None,
    broker_id: str | None,
    is_active: bool | None,
    role: str | None,
    broker_id_set: bool = False,
) -> User:
    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if email is not None and email != user.email:
        if get_user_by_email(db, email) is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        user.email = email

    if broker_id_set:
        _validate_broker_id(db, broker_id)
        user.broker_id = broker_id

    if is_active is not None:
        user.is_active = is_active

    if role is not None:
        user.role = role

    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int, current_user_id: int) -> None:
    if user_id == current_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")

    user = get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    db.delete(user)
    db.commit()


def set_password(db: Session, user: User, new_password: str) -> None:
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    db.commit()


def seed_default_admin(db: Session) -> None:
    if db.scalar(select(User).limit(1)) is not None:
        return

    admin = User(
        email=DEFAULT_ADMIN_EMAIL,
        password_hash=hash_password(DEFAULT_ADMIN_PASSWORD),
        role="admin",
        broker_id=None,
        is_active=True,
        must_change_password=True,
    )
    db.add(admin)
    db.commit()

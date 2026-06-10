from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import require_admin
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/admin/users", dependencies=[Depends(require_admin)])


def _to_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        role=user.role,
        brokerId=user.broker_id,
        isActive=user.is_active,
        mustChangePassword=user.must_change_password,
        createdAt=user.created_at,
        updatedAt=user.updated_at,
    )


@router.get("/", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)) -> list[UserOut]:
    return [_to_out(user) for user in user_service.list_users(db)]


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> UserOut:
    user = user_service.create_user(db, payload.email, payload.password, payload.role, payload.brokerId)
    return _to_out(user)


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)) -> UserOut:
    user = user_service.update_user(
        db,
        user_id,
        email=payload.email,
        broker_id=payload.brokerId,
        is_active=payload.isActive,
        role=payload.role,
        broker_id_set=payload.brokerIdSet,
    )
    return _to_out(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> None:
    user_service.delete_user(db, user_id, current_user.id)

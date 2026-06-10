from datetime import datetime

from pydantic import BaseModel


class UserCreate(BaseModel):
    email: str
    password: str
    role: str
    brokerId: str | None = None


class UserUpdate(BaseModel):
    email: str | None = None
    brokerId: str | None = None
    brokerIdSet: bool = False
    isActive: bool | None = None
    role: str | None = None


class UserOut(BaseModel):
    id: int
    email: str
    role: str
    brokerId: str | None
    isActive: bool
    mustChangePassword: bool
    createdAt: datetime
    updatedAt: datetime

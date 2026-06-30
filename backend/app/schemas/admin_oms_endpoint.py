from datetime import datetime

from pydantic import BaseModel


class OmsEndpointCreate(BaseModel):
    name: str
    baseUrl: str
    credentialName: str
    username: str
    password: str
    deviceId: str
    appType: int = 1


class OmsEndpointUpdate(BaseModel):
    baseUrl: str
    username: str
    password: str | None = None  # omit/null = keep existing password unchanged
    deviceId: str
    appType: int = 1


class OmsEndpointOut(BaseModel):
    name: str
    baseUrl: str
    credentialName: str
    username: str
    deviceId: str
    appType: int
    createdAt: datetime
    updatedAt: datetime

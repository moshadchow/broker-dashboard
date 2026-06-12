from datetime import datetime

from pydantic import BaseModel


class BrokerCreate(BaseModel):
    brokerId: str
    brokerLabel: str
    externalApiId: str | None = None


class BrokerUpdate(BaseModel):
    brokerLabel: str
    externalApiId: str | None = None


class BrokerOut(BaseModel):
    brokerId: str
    brokerLabel: str
    externalApiId: str | None
    createdAt: datetime
    updatedAt: datetime

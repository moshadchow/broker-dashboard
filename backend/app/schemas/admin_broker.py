from datetime import datetime

from pydantic import BaseModel


class BrokerCreate(BaseModel):
    brokerId: str
    brokerLabel: str


class BrokerUpdate(BaseModel):
    brokerLabel: str


class BrokerOut(BaseModel):
    brokerId: str
    brokerLabel: str
    createdAt: datetime
    updatedAt: datetime

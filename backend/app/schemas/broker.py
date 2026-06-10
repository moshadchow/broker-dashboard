from datetime import datetime

from pydantic import BaseModel


class BrokerRowOut(BaseModel):
    brokerId: str
    label: str
    fetchError: bool
    totalExecutionReport: int
    totalTrade: int
    buyTrade: int
    sellTrade: int
    totalValue: float
    buyValue: float
    sellValue: float


class BrokerDataResponse(BaseModel):
    success: bool
    fromDate: str
    toDate: str
    fetchedAt: datetime | None
    brokers: list[BrokerRowOut]

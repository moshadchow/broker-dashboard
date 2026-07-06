from datetime import datetime

from pydantic import BaseModel


class MarketRowOut(BaseModel):
    snapshotDate: str
    times: int
    closes: float
    ltps: float
    ycps: float
    opens: float
    highs: float
    lows: float
    settlementPrices: float
    volumes: int
    trades: int
    values: float
    changes: float
    changePercentages: float


class MarketDataResponse(BaseModel):
    success: bool
    stockExchange: str
    fetchedAt: datetime | None
    market: MarketRowOut | None

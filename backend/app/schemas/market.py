from datetime import datetime

from pydantic import BaseModel


class MarketRowOut(BaseModel):
    date: str
    low: float
    volume: int
    trade: int
    value: float
    gainer: int
    loser: int
    unchanged: int


class MarketDataResponse(BaseModel):
    success: bool
    stockExchange: str
    fetchedAt: datetime | None
    market: MarketRowOut | None

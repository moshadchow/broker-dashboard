from pydantic import BaseModel


class TrendSeries(BaseModel):
    ownBroker: list[float] | None = None
    xfl: list[float]
    market: list[float]
    pctOfXfl: list[float] | None = None
    pctOfMarket: list[float]


class TrendResponse(BaseModel):
    success: bool
    dates: list[str]
    trades: TrendSeries
    value: TrendSeries
    ownBrokerLabel: str | None = None

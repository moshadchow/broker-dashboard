from pydantic import BaseModel


class TrendSeries(BaseModel):
    own_broker: list[float] | None = None
    xfl: list[float]
    market: list[float]
    pct_of_xfl: list[float] | None = None
    pct_of_market: list[float]


class TrendResponse(BaseModel):
    success: bool
    dates: list[str]
    trades: TrendSeries
    value: TrendSeries

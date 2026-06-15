from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.broker import Broker
from app.models.broker_snapshot import BrokerSnapshot
from app.models.market_snapshot import MarketSnapshot
from app.models.user import User
from app.schemas.dashboard import TrendResponse, TrendSeries

router = APIRouter(prefix="/api/dashboard")

# metric name -> (BrokerSnapshot field, MarketSnapshot field)
METRIC_FIELDS: dict[str, tuple[str, str]] = {
    "trade": ("total_trade", "trade"),
    "value": ("total_value", "value"),
}

# MarketSnapshot.value is reported by the external API in millions, while
# BrokerSnapshot.total_value is in actual currency units — normalize to match.
MARKET_VALUE_MULTIPLIER = 1_000_000


def _date_range(from_date: date, to_date: date) -> list[date]:
    days = (to_date - from_date).days
    return [from_date + timedelta(days=i) for i in range(days + 1)]


def _build_series(
    dates: list[date],
    by_date_broker: dict[date, dict[str, dict[str, float]]],
    market_by_date: dict[date, dict[str, float]],
    metric: str,
    show_own_broker: bool,
    own_broker_id: str | None,
) -> TrendSeries:
    own_broker: list[float] = []
    xfl: list[float] = []
    market: list[float] = []
    pct_of_xfl: list[float] = []
    pct_of_market: list[float] = []

    for day in dates:
        broker_values = by_date_broker.get(day, {})
        xfl_total = sum(values[metric] for values in broker_values.values())
        market_value = market_by_date.get(day, {}).get(metric, 0.0)

        xfl.append(xfl_total)
        market.append(market_value)

        if show_own_broker:
            own_value = broker_values.get(own_broker_id, {}).get(metric, 0.0)
            own_broker.append(own_value)
            pct_of_xfl.append((own_value / xfl_total * 100) if xfl_total > 0 else 0.0)
            pct_of_market.append((own_value / market_value * 100) if market_value > 0 else 0.0)
        else:
            pct_of_market.append((xfl_total / market_value * 100) if market_value > 0 else 0.0)

    return TrendSeries(
        ownBroker=own_broker if show_own_broker else None,
        xfl=xfl,
        market=market,
        pctOfXfl=pct_of_xfl if show_own_broker else None,
        pctOfMarket=pct_of_market,
    )


@router.get("/trend", response_model=TrendResponse, response_model_exclude_none=True)
def get_trend(
    fromDate: date = Query(...),
    toDate: date = Query(...),
    stockExchange: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TrendResponse:
    snapshot_rows = db.scalars(
        select(BrokerSnapshot).where(
            BrokerSnapshot.from_date == BrokerSnapshot.to_date,
            BrokerSnapshot.from_date >= fromDate,
            BrokerSnapshot.from_date <= toDate,
        )
    ).all()

    by_date_broker: dict[date, dict[str, dict[str, float]]] = {}
    for row in snapshot_rows:
        by_date_broker.setdefault(row.from_date, {})[row.broker_id] = {
            "trade": float(row.total_trade),
            "value": float(row.total_value),
        }

    market_rows = db.scalars(
        select(MarketSnapshot).where(
            MarketSnapshot.stock_exchange == stockExchange,
            MarketSnapshot.snapshot_date >= fromDate,
            MarketSnapshot.snapshot_date <= toDate,
        )
    ).all()
    market_by_date: dict[date, dict[str, float]] = {
        row.snapshot_date: {
            "trade": float(row.trade),
            "value": float(row.value) * MARKET_VALUE_MULTIPLIER,
        }
        for row in market_rows
    }

    show_own_broker = current_user.role == "user" and current_user.broker_id is not None

    own_broker_label: str | None = None
    if show_own_broker:
        own_broker = db.get(Broker, current_user.broker_id)
        if own_broker is not None:
            own_broker_label = own_broker.broker_label

    dates = _date_range(fromDate, toDate)

    return TrendResponse(
        success=True,
        dates=[day.isoformat() for day in dates],
        trades=_build_series(
            dates, by_date_broker, market_by_date, "trade", show_own_broker, current_user.broker_id
        ),
        value=_build_series(
            dates, by_date_broker, market_by_date, "value", show_own_broker, current_user.broker_id
        ),
        ownBrokerLabel=own_broker_label,
    )

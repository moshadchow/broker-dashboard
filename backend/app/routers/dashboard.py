from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.broker import Broker
from app.models.broker_snapshot import BrokerSnapshot
from app.models.market_snapshot import MarketSnapshot
from app.models.user import User
from app.schemas.dashboard import TrendResponse, TrendSeries

router = APIRouter(prefix="/api/dashboard")


def _row_value(row, key: str):
    mapping = getattr(row, "_mapping", None)
    if mapping is not None:
        return mapping[key]
    return getattr(row, key)


def _build_series(
    dates: list[date],
    xfl_by_date: dict[date, dict[str, float]],
    market_by_date: dict[date, dict[str, float]],
    metric: str,
    show_own_broker: bool,
    own_by_date: dict[date, dict[str, float]] | None,
) -> TrendSeries:
    own_broker: list[float] = []
    xfl: list[float] = []
    market: list[float] = []
    pct_of_xfl: list[float] = []
    pct_of_market: list[float] = []

    for day in dates:
        xfl_total = xfl_by_date.get(day, {}).get(metric, 0.0)
        market_value = market_by_date.get(day, {}).get(metric, 0.0)

        xfl.append(xfl_total)
        market.append(market_value)

        if show_own_broker:
            own_value = (own_by_date or {}).get(day, {}).get(metric, 0.0)
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


def _latest_market_by_date(rows) -> dict[date, dict[str, float]]:
    market_by_date: dict[date, dict[str, float]] = {}
    for row in rows:
        market_by_date[_row_value(row, "snapshot_date")] = {
            "trade": float(_row_value(row, "trades")),
            "value": float(_row_value(row, "values")),
        }
    return market_by_date


def _snapshot_rows_by_date(rows) -> dict[date, dict[str, float]]:
    return {
        _row_value(row, "snapshot_date"): {
            "trade": float(_row_value(row, "trades") or 0),
            "value": float(_row_value(row, "values") or 0),
        }
        for row in rows
    }


@router.get("/trend", response_model=TrendResponse, response_model_exclude_none=True)
def get_trend(
    fromDate: date = Query(...),
    toDate: date = Query(...),
    stockExchange: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TrendResponse:
    xfl_rows = db.execute(
        select(
            BrokerSnapshot.from_date.label("snapshot_date"),
            func.sum(BrokerSnapshot.total_trade).label("trades"),
            func.sum(BrokerSnapshot.total_value).label("values"),
        )
        .where(
            BrokerSnapshot.from_date == BrokerSnapshot.to_date,
            BrokerSnapshot.from_date >= fromDate,
            BrokerSnapshot.from_date <= toDate,
        )
        .group_by(BrokerSnapshot.from_date)
        .order_by(BrokerSnapshot.from_date.asc())
    ).all()
    xfl_by_date = _snapshot_rows_by_date(xfl_rows)

    ranked_market = (
        select(
            MarketSnapshot.snapshot_date,
            MarketSnapshot.trades,
            MarketSnapshot.values,
            func.row_number()
            .over(
                partition_by=MarketSnapshot.snapshot_date,
                order_by=(
                    MarketSnapshot.times.desc(),
                    MarketSnapshot.fetched_at.desc(),
                    MarketSnapshot.id.desc(),
                ),
            )
            .label("row_num"),
        )
        .where(
            MarketSnapshot.stock_exchange == stockExchange,
            MarketSnapshot.snapshot_date >= fromDate,
            MarketSnapshot.snapshot_date <= toDate,
        )
        .subquery()
    )
    market_rows = db.execute(
        select(
            ranked_market.c.snapshot_date,
            ranked_market.c.trades,
            ranked_market.c["values"],
        )
        .where(ranked_market.c.row_num == 1)
        .order_by(ranked_market.c.snapshot_date.asc())
    ).all()
    market_by_date = _latest_market_by_date(market_rows)

    show_own_broker = current_user.role == "user" and current_user.broker_id is not None

    own_broker_label: str | None = None
    own_external_api_id: str | None = None
    own_by_date: dict[date, dict[str, float]] | None = None
    if show_own_broker:
        own_broker = db.get(Broker, current_user.broker_id)
        if own_broker is not None:
            own_broker_label = own_broker.broker_label
            own_external_api_id = own_broker.external_api_id
            own_rows = db.execute(
                select(
                    BrokerSnapshot.from_date.label("snapshot_date"),
                    BrokerSnapshot.total_trade.label("trades"),
                    BrokerSnapshot.total_value.label("values"),
                )
                .where(
                    BrokerSnapshot.broker_id == own_external_api_id,
                    BrokerSnapshot.from_date == BrokerSnapshot.to_date,
                    BrokerSnapshot.from_date >= fromDate,
                    BrokerSnapshot.from_date <= toDate,
                )
                .order_by(BrokerSnapshot.from_date.asc())
            ).all()
            own_by_date = _snapshot_rows_by_date(own_rows)

    dates = sorted(market_by_date)

    return TrendResponse(
        success=True,
        dates=[day.isoformat() for day in dates],
        trades=_build_series(
            dates, xfl_by_date, market_by_date, "trade", show_own_broker, own_by_date
        ),
        value=_build_series(
            dates, xfl_by_date, market_by_date, "value", show_own_broker, own_by_date
        ),
        ownBrokerLabel=own_broker_label,
    )

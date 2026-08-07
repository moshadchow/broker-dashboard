from datetime import date, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.config_data.exchanges import validate_exchange
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.broker_snapshot import BrokerSnapshot
from app.models.market_snapshot import MarketSnapshot
from app.models.pipeline_log import PipelineLog
from app.models.token_store import TokenStore
from app.models.user import User
from app.schemas.broker import BrokerAggregateOut, BrokerDataResponse, BrokerRowOut
from app.schemas.market import MarketDataResponse, MarketRowOut
from app.schemas.token import EndpointTokenStatus, LastPipelineRun, TokenStatusResponse
from app.scheduler.jobs import DAILY_JOB_ID, scheduler
from app.services import broker_service, oms_endpoint_service
from app.services.fetch_service import ZERO_BROKER_DATA
from app.services.pipeline import run_pipeline
from app.utils.time import is_expiring_soon, today_local

router = APIRouter(prefix="/api/internal")


def _aware_utc(dt):
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


@router.get("/broker-data", response_model=BrokerDataResponse)
def get_broker_data(
    toDate: date = Query(default=None),
    stockExchange: str = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BrokerDataResponse:
    if toDate is None:
        toDate = today_local()

    try:
        exchange = validate_exchange(stockExchange)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rows: list[BrokerRowOut] = []
    latest_fetched_at = None

    all_brokers = broker_service.list_brokers_for_pipeline(db)

    if current_user.role == "user" and current_user.broker_id is not None:
        brokers_to_show = [b for b in all_brokers if b.broker_id == current_user.broker_id]
    else:
        brokers_to_show = all_brokers

    snapshots_by_broker: dict[str, BrokerSnapshot] = {}
    for snapshot in db.scalars(
        select(BrokerSnapshot)
        .where(
            BrokerSnapshot.stock_exchange == exchange,
            BrokerSnapshot.to_date == toDate,
        )
        .order_by(BrokerSnapshot.fetched_at.desc())
    ):
        snapshots_by_broker.setdefault(snapshot.broker_id, snapshot)

    for broker in brokers_to_show:
        snapshot = snapshots_by_broker.get(broker.external_api_id)
        if snapshot is None:
            rows.append(
                BrokerRowOut(
                    brokerId=broker.external_api_id,
                    label=broker.broker_label,
                    fetchError=True,
                    **ZERO_BROKER_DATA,
                )
            )
            continue

        if latest_fetched_at is None or snapshot.fetched_at > latest_fetched_at:
            latest_fetched_at = snapshot.fetched_at

        rows.append(
            BrokerRowOut(
                brokerId=snapshot.broker_id,
                label=snapshot.broker_label,
                fetchError=snapshot.fetch_error,
                totalExecutionReport=snapshot.total_execution_report,
                totalTrade=snapshot.total_trade,
                buyTrade=snapshot.buy_trade,
                sellTrade=snapshot.sell_trade,
                totalValue=float(snapshot.total_value),
                buyValue=float(snapshot.buy_value),
                sellValue=float(snapshot.sell_value),
            )
        )

    aggregate = BrokerAggregateOut(
        totalExecutionReport=sum(s.total_execution_report for s in snapshots_by_broker.values()),
        totalTrade=sum(s.total_trade for s in snapshots_by_broker.values()),
        buyTrade=sum(s.buy_trade for s in snapshots_by_broker.values()),
        sellTrade=sum(s.sell_trade for s in snapshots_by_broker.values()),
        totalValue=float(sum(s.total_value for s in snapshots_by_broker.values())),
        buyValue=float(sum(s.buy_value for s in snapshots_by_broker.values())),
        sellValue=float(sum(s.sell_value for s in snapshots_by_broker.values())),
    )

    return BrokerDataResponse(
        success=True,
        fromDate=toDate.isoformat(),
        toDate=toDate.isoformat(),
        fetchedAt=_aware_utc(latest_fetched_at),
        brokers=rows,
        aggregate=aggregate,
    )


@router.get("/market-data", response_model=MarketDataResponse)
def get_market_data(
    toDate: date = Query(default=None),
    stockExchange: str = Query(default=None),
    db: Session = Depends(get_db),
) -> MarketDataResponse:
    if toDate is None:
        toDate = today_local()

    try:
        exchange = validate_exchange(stockExchange)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    snapshot = db.scalar(
        select(MarketSnapshot)
        .where(
            MarketSnapshot.stock_exchange == exchange,
            MarketSnapshot.snapshot_date == toDate,
        )
        .order_by(MarketSnapshot.times.desc(), MarketSnapshot.fetched_at.desc())
        .limit(1)
    )

    if snapshot is None:
        return MarketDataResponse(
            success=False,
            stockExchange=exchange,
            fetchedAt=None,
            market=None,
        )

    return MarketDataResponse(
        success=True,
        stockExchange=snapshot.stock_exchange,
        fetchedAt=_aware_utc(snapshot.fetched_at),
        market=MarketRowOut(
            snapshotDate=snapshot.snapshot_date.isoformat(),
            times=snapshot.times,
            closes=float(snapshot.closes),
            ltps=float(snapshot.ltps),
            ycps=float(snapshot.ycps),
            opens=float(snapshot.opens),
            highs=float(snapshot.highs),
            lows=float(snapshot.lows),
            settlementPrices=float(snapshot.settlement_prices),
            volumes=snapshot.volumes,
            trades=snapshot.trades,
            values=float(snapshot.values),
            changes=float(snapshot.changes),
            changePercentages=float(snapshot.change_percentages),
        ),
    )


@router.get("/token-status", response_model=TokenStatusResponse)
def get_token_status(db: Session = Depends(get_db)) -> TokenStatusResponse:
    token = db.get(TokenStore, "broker_summary")
    last_log = db.scalar(select(PipelineLog).order_by(PipelineLog.id.desc()).limit(1))

    job = scheduler.get_job(DAILY_JOB_ID)
    next_run = job.next_run_time if job else None

    last_pipeline_run = None
    if last_log is not None:
        last_pipeline_run = LastPipelineRun(
            status=last_log.status,
            finishedAt=_aware_utc(last_log.run_finished_at),
            brokersOk=last_log.brokers_ok,
            brokersFailed=last_log.brokers_failed,
            marketOk=last_log.market_ok,
        )

    endpoint_statuses: list[EndpointTokenStatus] = []
    for endpoint_name, endpoint in oms_endpoint_service.get_active_endpoints(db).items():
        endpoint_token = db.get(TokenStore, endpoint.credentials.name)
        if endpoint_token is None:
            endpoint_statuses.append(
                EndpointTokenStatus(
                    endpoint=endpoint_name, hasToken=False, valid=False, expiresAt=None, lastUpdated=None
                )
            )
            continue
        endpoint_statuses.append(
            EndpointTokenStatus(
                endpoint=endpoint_name,
                hasToken=True,
                valid=not is_expiring_soon(endpoint_token.expires_at, settings.token_refresh_skew_minutes),
                expiresAt=_aware_utc(endpoint_token.expires_at),
                lastUpdated=_aware_utc(endpoint_token.updated_at),
            )
        )

    if token is None:
        return TokenStatusResponse(
            hasToken=False,
            valid=False,
            expiresAt=None,
            lastUpdated=None,
            nextScheduledRun=next_run,
            lastPipelineRun=last_pipeline_run,
            endpoints=endpoint_statuses,
        )

    valid = not is_expiring_soon(token.expires_at, settings.token_refresh_skew_minutes)

    return TokenStatusResponse(
        hasToken=True,
        valid=valid,
        expiresAt=_aware_utc(token.expires_at),
        lastUpdated=_aware_utc(token.updated_at),
        nextScheduledRun=next_run,
        lastPipelineRun=last_pipeline_run,
        endpoints=endpoint_statuses,
    )


@router.post("/trigger-pipeline")
def trigger_pipeline(background_tasks: BackgroundTasks) -> dict:
    background_tasks.add_task(run_pipeline)
    return {"triggered": True}

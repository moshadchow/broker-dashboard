from datetime import timezone

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.config_data.brokers import BROKERS
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.broker_snapshot import BrokerSnapshot
from app.models.market_snapshot import MarketSnapshot
from app.models.pipeline_log import PipelineLog
from app.models.token_store import TokenStore
from app.models.user import User
from app.schemas.broker import BrokerDataResponse, BrokerRowOut
from app.schemas.market import MarketDataResponse, MarketRowOut
from app.schemas.token import LastPipelineRun, TokenStatusResponse
from app.scheduler.jobs import DAILY_JOB_ID, scheduler
from app.services.fetch_service import ZERO_BROKER_DATA
from app.services.pipeline import run_pipeline
from app.utils.time import is_expiring_soon, today_local_iso

router = APIRouter(prefix="/api/internal")


def _aware_utc(dt):
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


@router.get("/broker-data", response_model=BrokerDataResponse)
def get_broker_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BrokerDataResponse:
    today = today_local_iso()
    rows: list[BrokerRowOut] = []
    latest_fetched_at = None

    if current_user.role == "user" and current_user.broker_id is not None:
        brokers_to_show = [b for b in BROKERS if b["id"] == current_user.broker_id]
    else:
        brokers_to_show = BROKERS

    for broker in brokers_to_show:
        snapshot = db.scalar(
            select(BrokerSnapshot)
            .where(BrokerSnapshot.broker_id == broker["id"])
            .order_by(BrokerSnapshot.fetched_at.desc())
            .limit(1)
        )
        if snapshot is None:
            rows.append(
                BrokerRowOut(
                    brokerId=broker["id"],
                    label=broker["label"],
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

    return BrokerDataResponse(
        success=True,
        fromDate=today,
        toDate=today,
        fetchedAt=_aware_utc(latest_fetched_at),
        brokers=rows,
    )


@router.get("/market-data", response_model=MarketDataResponse)
def get_market_data(db: Session = Depends(get_db)) -> MarketDataResponse:
    snapshot = db.scalar(
        select(MarketSnapshot)
        .where(MarketSnapshot.stock_exchange == settings.default_stock_exchange)
        .order_by(MarketSnapshot.fetched_at.desc())
        .limit(1)
    )

    if snapshot is None:
        return MarketDataResponse(
            success=False,
            stockExchange=settings.default_stock_exchange,
            fetchedAt=None,
            market=None,
        )

    return MarketDataResponse(
        success=True,
        stockExchange=snapshot.stock_exchange,
        fetchedAt=_aware_utc(snapshot.fetched_at),
        market=MarketRowOut(
            date=snapshot.market_date,
            low=float(snapshot.low),
            volume=snapshot.volume,
            trade=snapshot.trade,
            value=float(snapshot.value),
            gainer=snapshot.gainer,
            loser=snapshot.loser,
            unchanged=snapshot.unchanged,
        ),
    )


@router.get("/token-status", response_model=TokenStatusResponse)
def get_token_status(db: Session = Depends(get_db)) -> TokenStatusResponse:
    token = db.get(TokenStore, 1)
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

    if token is None:
        return TokenStatusResponse(
            hasToken=False,
            valid=False,
            expiresAt=None,
            lastUpdated=None,
            nextScheduledRun=next_run,
            lastPipelineRun=last_pipeline_run,
        )

    valid = not is_expiring_soon(token.expires_at, settings.token_refresh_skew_minutes)

    return TokenStatusResponse(
        hasToken=True,
        valid=valid,
        expiresAt=_aware_utc(token.expires_at),
        lastUpdated=_aware_utc(token.updated_at),
        nextScheduledRun=next_run,
        lastPipelineRun=last_pipeline_run,
    )


@router.post("/trigger-pipeline")
def trigger_pipeline(background_tasks: BackgroundTasks) -> dict:
    background_tasks.add_task(run_pipeline)
    return {"triggered": True}

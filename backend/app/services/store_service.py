from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.orm import Session

from app.models.broker_snapshot import BrokerSnapshot
from app.models.market_snapshot import MarketSnapshot
from app.models.pipeline_log import PipelineLog
from app.services.fetch_service import ZERO_BROKER_DATA


def store_broker_results(db: Session, broker_results: list[dict], from_date: str, to_date: str) -> None:
    for result in broker_results:
        broker = result["broker"]
        data = result["data"] or ZERO_BROKER_DATA
        values = dict(
            broker_id=broker["id"],
            broker_label=broker["label"],
            from_date=from_date,
            to_date=to_date,
            total_execution_report=data["totalExecutionReport"],
            total_trade=data["totalTrade"],
            buy_trade=data["buyTrade"],
            sell_trade=data["sellTrade"],
            total_value=data["totalValue"],
            buy_value=data["buyValue"],
            sell_value=data["sellValue"],
            fetch_error=result["fetch_error"],
        )
        stmt = mysql_insert(BrokerSnapshot).values(**values)
        update_cols = {k: getattr(stmt.inserted, k) for k in values if k not in ("broker_id", "from_date", "to_date")}
        update_cols["fetched_at"] = func.now()
        stmt = stmt.on_duplicate_key_update(**update_cols)
        db.execute(stmt)
    db.commit()


def store_market_result(db: Session, market_data: list[dict] | None, stock_exchange: str, snapshot_date: date) -> None:
    if not market_data:
        return

    try:
        for row in market_data:
            values = dict(row)
            values["stock_exchange"] = stock_exchange
            stmt = mysql_insert(MarketSnapshot).values(**values)
            update_cols = {
                k: getattr(stmt.inserted, k)
                for k in values
                if k not in ("stock_exchange", "snapshot_date", "times")
            }
            update_cols["fetched_at"] = func.now()
            stmt = stmt.on_duplicate_key_update(**update_cols)
            db.execute(stmt)
        db.commit()
    except Exception:
        db.rollback()
        raise


def log_pipeline_run(
    db: Session,
    started_at: datetime,
    finished_at: datetime,
    status: str,
    brokers_ok: int,
    brokers_failed: int,
    market_ok: bool,
    error_message: str | None = None,
) -> None:
    db.add(
        PipelineLog(
            run_started_at=started_at,
            run_finished_at=finished_at,
            status=status,
            duration_ms=int((finished_at - started_at).total_seconds() * 1000),
            brokers_ok=brokers_ok,
            brokers_failed=brokers_failed,
            market_ok=market_ok,
            error_message=error_message,
        )
    )
    db.commit()

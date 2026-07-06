"""One-off seed: random broker_snapshots + market_snapshots for the previous 7 days.

Usage (from backend/, with venv activated):
    python -m scripts.seed_trend_data
"""
import random
from datetime import datetime, time, timedelta

from sqlalchemy import func
from sqlalchemy.dialects.mysql import insert as mysql_insert

from app.config import settings
from app.config_data.brokers import BROKERS
from app.db.session import SessionLocal
from app.models.broker_snapshot import BrokerSnapshot
from app.models.market_snapshot import MarketSnapshot
from app.utils.time import app_tz, today_local

DAYS_BACK = 7


def random_broker_row(broker: dict, day) -> dict:
    total_trade = random.randint(500, 5000)
    buy_trade = random.randint(0, total_trade)
    sell_trade = total_trade - buy_trade
    total_value = round(random.uniform(1_000, 50_000), 4)
    buy_value = round(random.uniform(0, total_value), 4)
    sell_value = round(total_value - buy_value, 4)

    return dict(
        broker_id=broker["id"],
        broker_label=broker["label"],
        from_date=day,
        to_date=day,
        total_execution_report=random.randint(total_trade, total_trade * 2),
        total_trade=total_trade,
        buy_trade=buy_trade,
        sell_trade=sell_trade,
        total_value=total_value,
        buy_value=buy_value,
        sell_value=sell_value,
        fetch_error=False,
    )


def random_market_row(stock_exchange: str, day) -> dict:
    trade = random.randint(50_000, 200_000)
    value = round(random.uniform(500_000, 2_000_000), 4)
    timestamp = int(datetime.combine(day, time.min, tzinfo=app_tz()).timestamp())

    return dict(
        stock_exchange=stock_exchange,
        snapshot_date=day,
        times=timestamp,
        closes=round(random.uniform(5000, 5500), 5),
        ltps=round(random.uniform(5000, 5500), 5),
        ycps=round(random.uniform(5000, 5500), 5),
        opens=round(random.uniform(5000, 5500), 5),
        highs=round(random.uniform(5500, 5700), 5),
        lows=round(random.uniform(4800, 5000), 5),
        settlement_prices=0,
        volumes=random.randint(1_000_000, 10_000_000),
        trades=trade,
        values=value,
        changes=round(random.uniform(-50, 50), 5),
        change_percentages=round(random.uniform(-2, 2), 5),
    )


def main() -> None:
    db = SessionLocal()
    try:
        today = today_local()
        for offset in range(1, DAYS_BACK + 1):
            day = today - timedelta(days=offset)

            for broker in BROKERS:
                values = random_broker_row(broker, day)
                stmt = mysql_insert(BrokerSnapshot).values(**values)
                update_cols = {
                    k: getattr(stmt.inserted, k)
                    for k in values
                    if k not in ("broker_id", "from_date", "to_date")
                }
                update_cols["fetched_at"] = func.now()
                stmt = stmt.on_duplicate_key_update(**update_cols)
                db.execute(stmt)

            market_values = random_market_row(settings.default_stock_exchange, day)
            stmt = mysql_insert(MarketSnapshot).values(**market_values)
            update_cols = {
                k: getattr(stmt.inserted, k)
                for k in market_values
                if k not in ("stock_exchange", "snapshot_date", "times")
            }
            update_cols["fetched_at"] = func.now()
            stmt = stmt.on_duplicate_key_update(**update_cols)
            db.execute(stmt)

            db.commit()
            print(f"Seeded {day.isoformat()}: {len(BROKERS)} brokers + market")
    finally:
        db.close()


if __name__ == "__main__":
    main()

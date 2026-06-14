"""Standalone backfill script for broker execution + market trade info.

Fetches data day-by-day for a date range from the external broker API and
upserts it into MySQL (`broker_snapshots` / `market_snapshots`). Independent
of the FastAPI backend package — only needs `requests` and
`mysql-connector-python`.

    pip install requests mysql-connector-python

Env vars:
    XFL_JWT          Bearer token sent on every request
    XFL_BROKER_IDS   Comma-separated external broker IDs to fetch
    XFL_DB_HOST      MySQL host
    XFL_DB_USER      MySQL user
    XFL_DB_PASS      MySQL password
    XFL_DB_NAME      MySQL database (e.g. broker_db)
    XFL_STOCK_EXCHANGE  Optional, defaults to "DSE"
    XFL_BASE_URL     Optional, defaults to the UAT API base URL

Usage:
    python fetch_data.py --from-date 2026-06-01 --to-date 2026-06-03
"""

import argparse
import logging
import os
from datetime import date, datetime, timedelta

import mysql.connector
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("fetch_data")

DEFAULT_BASE_URL = "https://uat.xfltrade.com:20121"
REQUEST_TIMEOUT = 30

# Keep in sync with backend/app/config_data/brokers.py
BROKER_LABELS: dict[str, str] = {
    "68d3b213bc4af8054a7dd843": "SNM",
    "68d3b25510420252a457a4e1": "BAL",
    "68d3b228bc4af8054a7dd85c": "EBS",
    "68d26fbafc08e0d825d20e43": "GDF",
    "68d3b23810420252a457a4c6": "IBB",
    "68d27053fc08e0d825d20e8e": "NLS",
    "68d27024fc08e0d825d20e75": "ONE",
    "68d3b247bc4af8054a7dd875": "SJB",
    "68d26fd0fc08e0d825d20e5c": "UBR",
}

CREATE_BROKER_SNAPSHOTS_TABLE = """
CREATE TABLE IF NOT EXISTS broker_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    broker_id VARCHAR(64) NOT NULL,
    broker_label VARCHAR(16) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    total_execution_report BIGINT NOT NULL DEFAULT 0,
    total_trade BIGINT NOT NULL DEFAULT 0,
    buy_trade BIGINT NOT NULL DEFAULT 0,
    sell_trade BIGINT NOT NULL DEFAULT 0,
    total_value DECIMAL(20,4) NOT NULL DEFAULT 0,
    buy_value DECIMAL(20,4) NOT NULL DEFAULT 0,
    sell_value DECIMAL(20,4) NOT NULL DEFAULT 0,
    fetch_error TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_broker_date (broker_id, from_date, to_date)
)
"""

CREATE_MARKET_SNAPSHOTS_TABLE = """
CREATE TABLE IF NOT EXISTS market_snapshots (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    stock_exchange VARCHAR(16) NOT NULL,
    snapshot_date DATE NOT NULL,
    market_date VARCHAR(32) NOT NULL,
    low DECIMAL(20,4) NOT NULL DEFAULT 0,
    volume BIGINT NOT NULL DEFAULT 0,
    trade BIGINT NOT NULL DEFAULT 0,
    value DECIMAL(20,4) NOT NULL DEFAULT 0,
    gainer INT NOT NULL DEFAULT 0,
    loser INT NOT NULL DEFAULT 0,
    unchanged INT NOT NULL DEFAULT 0,
    fetch_error TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_exchange_day (stock_exchange, snapshot_date)
)
"""

ADD_MARKET_FETCH_ERROR_COLUMN = """
ALTER TABLE market_snapshots ADD COLUMN fetch_error TINYINT(1) NOT NULL DEFAULT 0
"""

UPSERT_BROKER_SNAPSHOT = """
INSERT INTO broker_snapshots (
    broker_id, broker_label, from_date, to_date,
    total_execution_report, total_trade, buy_trade, sell_trade,
    total_value, buy_value, sell_value, fetch_error
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE
    broker_label = VALUES(broker_label),
    total_execution_report = VALUES(total_execution_report),
    total_trade = VALUES(total_trade),
    buy_trade = VALUES(buy_trade),
    sell_trade = VALUES(sell_trade),
    total_value = VALUES(total_value),
    buy_value = VALUES(buy_value),
    sell_value = VALUES(sell_value),
    fetch_error = VALUES(fetch_error)
"""

UPSERT_MARKET_SNAPSHOT = """
INSERT INTO market_snapshots (
    stock_exchange, snapshot_date, market_date,
    low, volume, trade, value, gainer, loser, unchanged, fetch_error
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON DUPLICATE KEY UPDATE
    market_date = VALUES(market_date),
    low = VALUES(low),
    volume = VALUES(volume),
    trade = VALUES(trade),
    value = VALUES(value),
    gainer = VALUES(gainer),
    loser = VALUES(loser),
    unchanged = VALUES(unchanged),
    fetch_error = VALUES(fetch_error)
"""


def load_config() -> dict:
    jwt = os.environ.get("XFL_JWT")
    broker_ids_raw = os.environ.get("XFL_BROKER_IDS")
    db_host = os.environ.get("XFL_DB_HOST")
    db_user = os.environ.get("XFL_DB_USER")
    db_pass = os.environ.get("XFL_DB_PASS")
    db_name = os.environ.get("XFL_DB_NAME")

    missing = [
        name
        for name, value in [
            ("XFL_JWT", jwt),
            ("XFL_BROKER_IDS", broker_ids_raw),
            ("XFL_DB_HOST", db_host),
            ("XFL_DB_USER", db_user),
            ("XFL_DB_PASS", db_pass),
            ("XFL_DB_NAME", db_name),
        ]
        if not value
    ]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)}")

    broker_ids = [b.strip() for b in broker_ids_raw.split(",") if b.strip()]
    if not broker_ids:
        raise RuntimeError("XFL_BROKER_IDS is empty")

    return {
        "jwt": jwt,
        "broker_ids": broker_ids,
        "stock_exchange": os.environ.get("XFL_STOCK_EXCHANGE", "DSE"),
        "base_url": os.environ.get("XFL_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
        "db": {
            "host": db_host,
            "user": db_user,
            "password": db_pass,
            "database": db_name,
        },
    }


def get_db_connection(db_config: dict):
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor()
    cursor.execute(CREATE_BROKER_SNAPSHOTS_TABLE)
    cursor.execute(CREATE_MARKET_SNAPSHOTS_TABLE)

    cursor.execute(
        """
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = %s AND table_name = 'market_snapshots' AND column_name = 'fetch_error'
        """,
        (db_config["database"],),
    )
    if cursor.fetchone()[0] == 0:
        cursor.execute(ADD_MARKET_FETCH_ERROR_COLUMN)

    conn.commit()
    cursor.close()
    return conn


def fetch_broker_summary(base_url: str, jwt: str, broker_id: str, from_date: str, to_date: str) -> dict | None:
    try:
        resp = requests.get(
            f"{base_url}/api/broker-summary/orders-execution",
            params={"fromDate": from_date, "toDate": to_date},
            headers={"Authorization": f"Bearer {jwt}", "X-BrokerId": broker_id},
            timeout=REQUEST_TIMEOUT,
            verify=False,
        )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("success"):
            logger.error("broker %s %s: success=false (%s)", broker_id, from_date, body.get("errorMessage"))
            return None
        return body["data"]
    except Exception:
        logger.error("broker %s %s: fetch failed", broker_id, from_date, exc_info=True)
        return None


def fetch_market_trade_info(base_url: str, jwt: str, stock_exchange: str) -> dict | None:
    try:
        resp = requests.get(
            f"{base_url}/api/indexes/{stock_exchange}/market-trade-info",
            headers={"Authorization": f"Bearer {jwt}"},
            timeout=REQUEST_TIMEOUT,
            verify=False,
        )
        resp.raise_for_status()
        body = resp.json()
        if not body.get("success"):
            logger.error("market %s: success=false (%s)", stock_exchange, body.get("errorMessage"))
            return None
        return body["data"]
    except Exception:
        logger.error("market %s: fetch failed", stock_exchange, exc_info=True)
        return None


def upsert_broker_snapshot(cursor, broker_id: str, label: str, day_str: str, data: dict | None) -> None:
    if data is None:
        values = (broker_id, label, day_str, day_str, 0, 0, 0, 0, 0, 0, 0, 1)
    else:
        values = (
            broker_id,
            label,
            day_str,
            day_str,
            data["totalExecutionReport"],
            data["totalTrade"],
            data["buyTrade"],
            data["sellTrade"],
            data["totalValue"],
            data["buyValue"],
            data["sellValue"],
            0,
        )
    cursor.execute(UPSERT_BROKER_SNAPSHOT, values)


def upsert_market_snapshot(cursor, stock_exchange: str, day: date, data: dict | None) -> None:
    if data is None:
        values = (stock_exchange, day, "", 0, 0, 0, 0, 0, 0, 0, 1)
    else:
        values = (
            stock_exchange,
            day,
            data["date"],
            data["low"],
            data["volume"],
            data["trade"],
            data["value"],
            data["gainer"],
            data["loser"],
            data["unchanged"],
            0,
        )
    cursor.execute(UPSERT_MARKET_SNAPSHOT, values)


def run(config: dict, from_date: date, to_date: date) -> None:
    conn = get_db_connection(config["db"])
    try:
        cursor = conn.cursor()
        current = from_date
        while current <= to_date:
            day_str = current.strftime("%Y-%m-%d")
            logger.info("=== %s ===", day_str)

            market_data = fetch_market_trade_info(config["base_url"], config["jwt"], config["stock_exchange"])
            upsert_market_snapshot(cursor, config["stock_exchange"], current, market_data)

            for broker_id in config["broker_ids"]:
                label = BROKER_LABELS.get(broker_id, broker_id)[:16]
                data = fetch_broker_summary(config["base_url"], config["jwt"], broker_id, day_str, day_str)
                upsert_broker_snapshot(cursor, broker_id, label, day_str, data)

            conn.commit()
            logger.info("%s committed", day_str)
            current += timedelta(days=1)
        cursor.close()
    finally:
        conn.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--to-date", required=True, help="YYYY-MM-DD")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    from_date = datetime.strptime(args.from_date, "%Y-%m-%d").date()
    to_date = datetime.strptime(args.to_date, "%Y-%m-%d").date()
    if from_date > to_date:
        raise ValueError("--from-date must be <= --to-date")

    config = load_config()
    run(config, from_date, to_date)


if __name__ == "__main__":
    main()

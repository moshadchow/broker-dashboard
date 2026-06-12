import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def ensure_broker_columns(engine: Engine) -> None:
    """Add external_api_id/order_index to an existing brokers table if missing.

    create_all() only creates missing tables, it does not alter existing
    ones, so a deployed brokers table predating these columns needs an
    explicit ALTER TABLE. Safe to call on every startup.
    """
    inspector = inspect(engine)
    if "brokers" not in inspector.get_table_names():
        return

    existing_cols = {col["name"] for col in inspector.get_columns("brokers")}
    with engine.begin() as conn:
        if "external_api_id" not in existing_cols:
            conn.execute(text("ALTER TABLE brokers ADD COLUMN external_api_id VARCHAR(32) NULL"))
            logger.info("Added column brokers.external_api_id")
        if "order_index" not in existing_cols:
            conn.execute(text("ALTER TABLE brokers ADD COLUMN order_index INT NULL"))
            logger.info("Added column brokers.order_index")

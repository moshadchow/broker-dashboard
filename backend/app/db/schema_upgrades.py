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


def ensure_token_store_credential_name(engine: Engine) -> None:
    """Migrate token_store from a singleton id=1 row to a credential_name PK.

    create_all() only creates missing tables, so a pre-existing token_store
    (id INT PK, chk_single_row CHECK(id=1)) needs an explicit migration to
    the new credential_name VARCHAR PK schema. Safe to call on every startup.
    """
    inspector = inspect(engine)
    if "token_store" not in inspector.get_table_names():
        return

    existing_cols = {col["name"] for col in inspector.get_columns("token_store")}
    if "credential_name" in existing_cols:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE token_store ADD COLUMN credential_name VARCHAR(32) NULL"))
        conn.execute(text("UPDATE token_store SET credential_name = 'broker_summary' WHERE id = 1"))

        for constraint in inspector.get_check_constraints("token_store"):
            conn.execute(text(f"ALTER TABLE token_store DROP CHECK {constraint['name']}"))

        conn.execute(text("ALTER TABLE token_store DROP PRIMARY KEY"))
        conn.execute(text("ALTER TABLE token_store MODIFY COLUMN credential_name VARCHAR(32) NOT NULL"))
        conn.execute(text("ALTER TABLE token_store ADD PRIMARY KEY (credential_name)"))
        conn.execute(text("ALTER TABLE token_store DROP COLUMN id"))
        logger.info("Migrated token_store to credential_name primary key")

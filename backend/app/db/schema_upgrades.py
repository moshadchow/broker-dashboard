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
        if "api_endpoint" not in existing_cols:
            conn.execute(text("ALTER TABLE brokers ADD COLUMN api_endpoint VARCHAR(20) NULL"))
            logger.info("Added column brokers.api_endpoint")


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


def ensure_oms_endpoint_fk(engine: Engine) -> None:
    """Add the FK from brokers.api_endpoint -> oms_endpoints.name.

    Must run AFTER oms_endpoints is created and seeded, and after brokers'
    api_endpoint values are backfilled — otherwise ADD CONSTRAINT fails on
    existing rows that don't match a seeded endpoint name. Idempotent: skips
    if the named FK already exists. Defensively nulls out any orphan
    api_endpoint value first (should never fire in the happy path — if it
    does, seeding ran out of order or failed upstream).
    """
    inspector = inspect(engine)
    if "brokers" not in inspector.get_table_names() or "oms_endpoints" not in inspector.get_table_names():
        return

    existing_fks = {fk["name"] for fk in inspector.get_foreign_keys("brokers")}
    if "fk_brokers_api_endpoint" in existing_fks:
        return

    with engine.begin() as conn:
        orphan_count = conn.execute(
            text(
                "SELECT COUNT(*) FROM brokers WHERE api_endpoint IS NOT NULL "
                "AND api_endpoint NOT IN (SELECT name FROM oms_endpoints)"
            )
        ).scalar()
        if orphan_count:
            logger.warning(
                "Nulling out %s brokers.api_endpoint value(s) with no matching oms_endpoints row",
                orphan_count,
            )
            conn.execute(
                text(
                    "UPDATE brokers SET api_endpoint = NULL WHERE api_endpoint IS NOT NULL "
                    "AND api_endpoint NOT IN (SELECT name FROM oms_endpoints)"
                )
            )

        conn.execute(
            text(
                "ALTER TABLE brokers ADD CONSTRAINT fk_brokers_api_endpoint "
                "FOREIGN KEY (api_endpoint) REFERENCES oms_endpoints(name) "
                "ON DELETE RESTRICT ON UPDATE CASCADE"
            )
        )
        logger.info("Added FK brokers.api_endpoint -> oms_endpoints.name")

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


def ensure_market_snapshot_share_price_history_schema(engine: Engine) -> None:
    """Migrate market_snapshots to the share-price-history row structure.

    Existing deployments may still have the old single-row daily market schema.
    New inserts only provide the share-price-history columns, so old required
    columns must be nullable and the old per-day unique key must be removed.
    """
    inspector = inspect(engine)
    if "market_snapshots" not in inspector.get_table_names():
        return

    existing_cols = {col["name"] for col in inspector.get_columns("market_snapshots")}
    new_columns = {
        "times": "BIGINT NOT NULL DEFAULT 0",
        "closes": "DECIMAL(20, 5) NOT NULL DEFAULT 0",
        "ltps": "DECIMAL(20, 5) NOT NULL DEFAULT 0",
        "ycps": "DECIMAL(20, 5) NOT NULL DEFAULT 0",
        "opens": "DECIMAL(20, 5) NOT NULL DEFAULT 0",
        "highs": "DECIMAL(20, 5) NOT NULL DEFAULT 0",
        "lows": "DECIMAL(20, 5) NOT NULL DEFAULT 0",
        "settlement_prices": "DECIMAL(20, 5) NOT NULL DEFAULT 0",
        "volumes": "BIGINT NOT NULL DEFAULT 0",
        "trades": "BIGINT NOT NULL DEFAULT 0",
        "values": "DECIMAL(20, 5) NOT NULL DEFAULT 0",
        "changes": "DECIMAL(20, 5) NOT NULL DEFAULT 0",
        "change_percentages": "DECIMAL(20, 5) NOT NULL DEFAULT 0",
    }
    old_columns_to_relax = {
        "market_date": "VARCHAR(32) NULL",
        "low": "DECIMAL(20, 4) NULL",
        "volume": "BIGINT NULL",
        "trade": "BIGINT NULL",
        "value": "DECIMAL(20, 4) NULL",
        "gainer": "INT NULL",
        "loser": "INT NULL",
        "unchanged": "INT NULL",
    }

    with engine.begin() as conn:
        for column_name, definition in new_columns.items():
            if column_name not in existing_cols:
                conn.execute(text(f"ALTER TABLE market_snapshots ADD COLUMN `{column_name}` {definition}"))
                logger.info("Added column market_snapshots.%s", column_name)

        for column_name, definition in old_columns_to_relax.items():
            if column_name in existing_cols:
                conn.execute(text(f"ALTER TABLE market_snapshots MODIFY COLUMN `{column_name}` {definition}"))

        unique_constraints = {constraint["name"] for constraint in inspector.get_unique_constraints("market_snapshots")}
        if "uq_exchange_day" in unique_constraints:
            conn.execute(text("ALTER TABLE market_snapshots DROP INDEX uq_exchange_day"))
            logger.info("Dropped unique index market_snapshots.uq_exchange_day")

        indexes = {index["name"] for index in inspector.get_indexes("market_snapshots")}
        if "idx_exchange_snapshot_date" not in indexes:
            conn.execute(
                text(
                    "CREATE INDEX idx_exchange_snapshot_date "
                    "ON market_snapshots (`stock_exchange`, `snapshot_date`)"
                )
            )
            logger.info("Added index market_snapshots.idx_exchange_snapshot_date")

        unique_constraints = {constraint["name"] for constraint in inspect(conn).get_unique_constraints("market_snapshots")}
        if "uq_exchange_day_time" not in unique_constraints:
            conn.execute(
                text(
                    "ALTER TABLE market_snapshots ADD CONSTRAINT uq_exchange_day_time "
                    "UNIQUE (`stock_exchange`, `snapshot_date`, `times`)"
                )
            )
            logger.info("Added unique index market_snapshots.uq_exchange_day_time")

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BrokerSnapshot(Base):
    __tablename__ = "broker_snapshots"
    __table_args__ = (
        UniqueConstraint("broker_id", "from_date", "to_date", name="uq_broker_date"),
        Index("idx_broker_fetched_at", "broker_id", "fetched_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    broker_id: Mapped[str] = mapped_column(String(64), nullable=False)
    broker_label: Mapped[str] = mapped_column(String(16), nullable=False)
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_execution_report: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    total_trade: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    buy_trade: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    sell_trade: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    total_value: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False, default=0)
    buy_value: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False, default=0)
    sell_value: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False, default=0)
    fetch_error: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

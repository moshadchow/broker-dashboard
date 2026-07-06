from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
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


class MarketSnapshot(Base):
    __tablename__ = "market_snapshots"
    __table_args__ = (
        UniqueConstraint("stock_exchange", "snapshot_date", "times", name="uq_exchange_day_time"),
        Index("idx_exchange_snapshot_date", "stock_exchange", "snapshot_date"),
        Index("idx_exchange_fetched_at", "stock_exchange", "fetched_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stock_exchange: Mapped[str] = mapped_column(String(16), nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    times: Mapped[int] = mapped_column(BigInteger, nullable=False)
    closes: Mapped[Decimal] = mapped_column(Numeric(20, 5), nullable=False, default=0)
    ltps: Mapped[Decimal] = mapped_column(Numeric(20, 5), nullable=False, default=0)
    ycps: Mapped[Decimal] = mapped_column(Numeric(20, 5), nullable=False, default=0)
    opens: Mapped[Decimal] = mapped_column(Numeric(20, 5), nullable=False, default=0)
    highs: Mapped[Decimal] = mapped_column(Numeric(20, 5), nullable=False, default=0)
    lows: Mapped[Decimal] = mapped_column(Numeric(20, 5), nullable=False, default=0)
    settlement_prices: Mapped[Decimal] = mapped_column(Numeric(20, 5), nullable=False, default=0)
    volumes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    trades: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    values: Mapped[Decimal] = mapped_column(Numeric(20, 5), nullable=False, default=0)
    changes: Mapped[Decimal] = mapped_column(Numeric(20, 5), nullable=False, default=0)
    change_percentages: Mapped[Decimal] = mapped_column(Numeric(20, 5), nullable=False, default=0)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

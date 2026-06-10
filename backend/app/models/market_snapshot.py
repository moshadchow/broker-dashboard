from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Index,
    Integer,
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
        UniqueConstraint("stock_exchange", "snapshot_date", name="uq_exchange_day"),
        Index("idx_exchange_fetched_at", "stock_exchange", "fetched_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    stock_exchange: Mapped[str] = mapped_column(String(16), nullable=False)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    market_date: Mapped[str] = mapped_column(String(32), nullable=False)
    low: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False, default=0)
    volume: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    trade: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    value: Mapped[Decimal] = mapped_column(Numeric(20, 4), nullable=False, default=0)
    gainer: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    loser: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unchanged: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

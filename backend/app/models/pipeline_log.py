from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, Index, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PipelineLog(Base):
    __tablename__ = "pipeline_logs"
    __table_args__ = (Index("idx_created_at", "created_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    run_started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    run_finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(Enum("success", "partial", "failed", name="pipeline_status"), nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    brokers_ok: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    brokers_failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    market_ok: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())

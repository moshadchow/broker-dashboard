from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Broker(Base):
    __tablename__ = "brokers"

    broker_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    broker_label: Mapped[str] = mapped_column(String(10), nullable=False)
    external_api_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    order_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    api_endpoint: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

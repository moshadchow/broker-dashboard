from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OmsEndpoint(Base):
    __tablename__ = "oms_endpoints"

    name: Mapped[str] = mapped_column(String(20), primary_key=True)
    base_url: Mapped[str] = mapped_column(String(255), nullable=False)
    credential_name: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    username: Mapped[str] = mapped_column(String(100), nullable=False)
    encrypted_password: Mapped[str] = mapped_column(Text, nullable=False)
    device_id: Mapped[str] = mapped_column(String(100), nullable=False)
    app_type: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

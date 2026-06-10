from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"
    __table_args__ = (Index("idx_token_blacklist_expires_at", "expires_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    jti: Mapped[str] = mapped_column(String(36), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

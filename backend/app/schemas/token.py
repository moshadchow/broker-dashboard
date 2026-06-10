from datetime import datetime

from pydantic import BaseModel


class LastPipelineRun(BaseModel):
    status: str
    finishedAt: datetime | None
    brokersOk: int
    brokersFailed: int
    marketOk: bool


class TokenStatusResponse(BaseModel):
    hasToken: bool
    valid: bool
    expiresAt: datetime | None
    lastUpdated: datetime | None
    nextScheduledRun: datetime | None
    lastPipelineRun: LastPipelineRun | None

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.base import Base
from app.db.schema_upgrades import (
    ensure_broker_columns,
    ensure_oms_endpoint_fk,
    ensure_token_store_credential_name,
)
from app.db.session import SessionLocal, engine
from app.routers import admin_brokers, admin_oms_endpoints, admin_users, auth, dashboard, internal
from app.scheduler.jobs import start_scheduler, stop_scheduler
from app.services import broker_service, user_service

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_token_store_credential_name(engine)
    Base.metadata.create_all(bind=engine)
    ensure_broker_columns(engine)

    db = SessionLocal()
    try:
        broker_service.seed_brokers(db)
        user_service.seed_default_admin(db)
    finally:
        db.close()

    ensure_oms_endpoint_fk(engine)

    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Broker Dashboard Auto-Credential Pipeline", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(internal.router)
app.include_router(dashboard.router)
app.include_router(auth.router)
app.include_router(admin_brokers.router)
app.include_router(admin_users.router)
app.include_router(admin_oms_endpoints.router)

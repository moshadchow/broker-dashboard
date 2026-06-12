from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import require_admin
from app.schemas.admin_broker import BrokerCreate, BrokerOut, BrokerUpdate
from app.services import broker_service

router = APIRouter(prefix="/admin/brokers", dependencies=[Depends(require_admin)])


def _to_out(broker) -> BrokerOut:
    return BrokerOut(
        brokerId=broker.broker_id,
        brokerLabel=broker.broker_label,
        externalApiId=broker.external_api_id,
        createdAt=broker.created_at,
        updatedAt=broker.updated_at,
    )


@router.get("/", response_model=list[BrokerOut])
def list_brokers(db: Session = Depends(get_db)) -> list[BrokerOut]:
    return [_to_out(broker) for broker in broker_service.list_brokers(db)]


@router.post("/", response_model=BrokerOut, status_code=status.HTTP_201_CREATED)
def create_broker(payload: BrokerCreate, db: Session = Depends(get_db)) -> BrokerOut:
    broker = broker_service.create_broker(db, payload.brokerId, payload.brokerLabel, payload.externalApiId)
    return _to_out(broker)


@router.put("/{broker_id}", response_model=BrokerOut)
def update_broker(broker_id: str, payload: BrokerUpdate, db: Session = Depends(get_db)) -> BrokerOut:
    broker = broker_service.update_broker(db, broker_id, payload.brokerLabel, payload.externalApiId)
    return _to_out(broker)


@router.delete("/{broker_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_broker(broker_id: str, db: Session = Depends(get_db)) -> None:
    broker_service.delete_broker(db, broker_id)

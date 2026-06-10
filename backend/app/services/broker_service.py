from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config_data.brokers import BROKERS
from app.models.broker import Broker
from app.models.user import User


def list_brokers(db: Session) -> list[Broker]:
    return list(db.scalars(select(Broker).order_by(Broker.broker_id)).all())


def get_broker(db: Session, broker_id: str) -> Broker | None:
    return db.get(Broker, broker_id)


def create_broker(db: Session, broker_id: str, broker_label: str) -> Broker:
    if get_broker(db, broker_id) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Broker ID already exists")

    broker = Broker(broker_id=broker_id, broker_label=broker_label)
    db.add(broker)
    db.commit()
    db.refresh(broker)
    return broker


def update_broker(db: Session, broker_id: str, broker_label: str) -> Broker:
    broker = get_broker(db, broker_id)
    if broker is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broker not found")

    broker.broker_label = broker_label
    db.commit()
    db.refresh(broker)
    return broker


def delete_broker(db: Session, broker_id: str) -> None:
    broker = get_broker(db, broker_id)
    if broker is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broker not found")

    in_use = db.scalar(select(User).where(User.broker_id == broker_id).limit(1))
    if in_use is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Broker is assigned to one or more users",
        )

    db.delete(broker)
    db.commit()


def seed_brokers(db: Session) -> None:
    if db.scalar(select(Broker).limit(1)) is not None:
        return

    for entry in BROKERS:
        label = entry["label"]
        db.add(Broker(broker_id=label, broker_label=label))
    db.commit()

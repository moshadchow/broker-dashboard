from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config_data.brokers import BROKERS
from app.models.broker import Broker
from app.models.user import User


def list_brokers(db: Session) -> list[Broker]:
    return list(db.scalars(select(Broker).order_by(Broker.broker_id)).all())


def list_brokers_for_pipeline(db: Session) -> list[Broker]:
    return list(
        db.scalars(
            select(Broker)
            .where(Broker.external_api_id.is_not(None))
            .order_by(Broker.order_index)
        ).all()
    )


def get_broker(db: Session, broker_id: str) -> Broker | None:
    return db.get(Broker, broker_id)


def create_broker(db: Session, broker_id: str, broker_label: str, external_api_id: str | None = None) -> Broker:
    if get_broker(db, broker_id) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Broker ID already exists")

    broker = Broker(broker_id=broker_id, broker_label=broker_label, external_api_id=external_api_id)
    db.add(broker)
    db.commit()
    db.refresh(broker)
    return broker


def update_broker(db: Session, broker_id: str, broker_label: str, external_api_id: str | None = None) -> Broker:
    broker = get_broker(db, broker_id)
    if broker is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Broker not found")

    broker.broker_label = broker_label
    broker.external_api_id = external_api_id
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
    existing = list(db.scalars(select(Broker)).all())

    if not existing:
        for index, entry in enumerate(BROKERS):
            label = entry["label"]
            db.add(
                Broker(
                    broker_id=label,
                    broker_label=label,
                    external_api_id=entry["id"],
                    order_index=index,
                )
            )
        db.commit()
        return

    # Existing install: backfill external_api_id/order_index for rows that
    # predate these columns, matched by broker_label. Idempotent.
    by_label = {entry["label"]: entry for entry in BROKERS}
    order_by_label = {entry["label"]: index for index, entry in enumerate(BROKERS)}

    changed = False
    for broker in existing:
        config_entry = by_label.get(broker.broker_label)
        if config_entry is None:
            continue

        if broker.external_api_id is None:
            broker.external_api_id = config_entry["id"]
            changed = True
        if broker.order_index is None:
            broker.order_index = order_by_label[broker.broker_label]
            changed = True

    if changed:
        db.commit()

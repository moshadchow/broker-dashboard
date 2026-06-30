from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import CredentialSet
from app.config import OmsEndpoint as OmsEndpointDataclass
from app.models.broker import Broker
from app.models.oms_endpoint import OmsEndpoint
from app.services.encryption_service import decrypt_password, encrypt_password


def list_oms_endpoints(db: Session) -> list[OmsEndpoint]:
    return list(db.scalars(select(OmsEndpoint).order_by(OmsEndpoint.name)).all())


def get_oms_endpoint(db: Session, name: str) -> OmsEndpoint | None:
    return db.get(OmsEndpoint, name)


def create_oms_endpoint(
    db: Session,
    name: str,
    base_url: str,
    credential_name: str,
    username: str,
    password: str,
    device_id: str,
    app_type: int = 1,
) -> OmsEndpoint:
    if get_oms_endpoint(db, name) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Endpoint name already exists")

    endpoint = OmsEndpoint(
        name=name,
        base_url=base_url,
        credential_name=credential_name,
        username=username,
        encrypted_password=encrypt_password(password),
        device_id=device_id,
        app_type=app_type,
    )
    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    return endpoint


def update_oms_endpoint(
    db: Session,
    name: str,
    base_url: str,
    username: str,
    device_id: str,
    app_type: int = 1,
    password: str | None = None,
) -> OmsEndpoint:
    endpoint = get_oms_endpoint(db, name)
    if endpoint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    endpoint.base_url = base_url
    endpoint.username = username
    endpoint.device_id = device_id
    endpoint.app_type = app_type
    if password:
        endpoint.encrypted_password = encrypt_password(password)
    db.commit()
    db.refresh(endpoint)
    return endpoint


def delete_oms_endpoint(db: Session, name: str) -> None:
    endpoint = get_oms_endpoint(db, name)
    if endpoint is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Endpoint not found")

    in_use = db.scalar(select(Broker).where(Broker.api_endpoint == name).limit(1))
    if in_use is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Endpoint is assigned to one or more brokers",
        )

    db.delete(endpoint)
    db.commit()


def _to_credential_set(row: OmsEndpoint) -> CredentialSet:
    return CredentialSet(
        name=row.credential_name,
        username=row.username,
        password=decrypt_password(row.encrypted_password),
        device_id=row.device_id,
        app_type=row.app_type,
        base_url=row.base_url,
    )


def get_active_endpoints(db: Session) -> dict[str, OmsEndpointDataclass]:
    """DB-backed replacement for the old settings.oms_endpoints property.

    Re-reads and re-decrypts on every call (no caching), so an admin edit
    takes effect on the very next pipeline call site invocation.
    """
    return {
        row.name: OmsEndpointDataclass(
            name=row.name, base_url=row.base_url, credentials=_to_credential_set(row)
        )
        for row in list_oms_endpoints(db)
    }


def get_endpoint_credentials(db: Session, name: str) -> CredentialSet | None:
    row = get_oms_endpoint(db, name)
    return _to_credential_set(row) if row else None

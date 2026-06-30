from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import require_admin
from app.schemas.admin_oms_endpoint import OmsEndpointCreate, OmsEndpointOut, OmsEndpointUpdate
from app.services import oms_endpoint_service

router = APIRouter(prefix="/admin/oms-endpoints", dependencies=[Depends(require_admin)])


def _to_out(endpoint) -> OmsEndpointOut:
    return OmsEndpointOut(
        name=endpoint.name,
        baseUrl=endpoint.base_url,
        credentialName=endpoint.credential_name,
        username=endpoint.username,
        deviceId=endpoint.device_id,
        appType=endpoint.app_type,
        createdAt=endpoint.created_at,
        updatedAt=endpoint.updated_at,
    )


@router.get("/", response_model=list[OmsEndpointOut])
def list_oms_endpoints(db: Session = Depends(get_db)) -> list[OmsEndpointOut]:
    return [_to_out(endpoint) for endpoint in oms_endpoint_service.list_oms_endpoints(db)]


@router.post("/", response_model=OmsEndpointOut, status_code=status.HTTP_201_CREATED)
def create_oms_endpoint(payload: OmsEndpointCreate, db: Session = Depends(get_db)) -> OmsEndpointOut:
    endpoint = oms_endpoint_service.create_oms_endpoint(
        db,
        payload.name,
        payload.baseUrl,
        payload.credentialName,
        payload.username,
        payload.password,
        payload.deviceId,
        payload.appType,
    )
    return _to_out(endpoint)


@router.put("/{name}", response_model=OmsEndpointOut)
def update_oms_endpoint(name: str, payload: OmsEndpointUpdate, db: Session = Depends(get_db)) -> OmsEndpointOut:
    endpoint = oms_endpoint_service.update_oms_endpoint(
        db,
        name,
        payload.baseUrl,
        payload.username,
        payload.deviceId,
        payload.appType,
        payload.password,
    )
    return _to_out(endpoint)


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_oms_endpoint(name: str, db: Session = Depends(get_db)) -> None:
    oms_endpoint_service.delete_oms_endpoint(db, name)

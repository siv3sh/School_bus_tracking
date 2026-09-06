from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.models.schemas import FLEET_ROLES, LocationUpdate, UserPublic
from app.services.auth_service import require_roles
from app.services.invite_service import as_object_id
from app.services.location_service import apply_location_update
from app.services.tenant import TenantScope, get_tenant_scope

router = APIRouter(prefix="/api/location", tags=["location"])


@router.post("/latest")
async def post_latest_location(
    body: LocationUpdate,
    _user: UserPublic = Depends(require_roles(*FLEET_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> dict:
    """Reliable fallback + offline-reconnect sync for the latest GPS point."""
    bus = await get_db().buses.find_one(scope.mongo_filter({"_id": as_object_id(body.bus_id, "bus_id")}))
    if not bus:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bus not found")
    try:
        updated = await apply_location_update(body)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"ok": True, "bus": updated}

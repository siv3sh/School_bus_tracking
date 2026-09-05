from fastapi import APIRouter, Depends, HTTPException, status

from app.models.schemas import LocationUpdate, Role, UserPublic
from app.services.auth_service import require_roles
from app.services.location_service import apply_location_update

router = APIRouter(prefix="/api/location", tags=["location"])


@router.post("/latest")
async def post_latest_location(
    body: LocationUpdate,
    _user: UserPublic = Depends(require_roles(Role.driver, Role.admin)),
) -> dict:
    """Reliable fallback + offline-reconnect sync for the latest GPS point."""
    try:
        bus = await apply_location_update(body)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"ok": True, "bus": bus}

import json

from bson import ObjectId
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.database import get_db
from app.models.schemas import LocationUpdate, Role
from app.services.auth_service import decode_token
from app.services.location_service import apply_location_update, enrich_bus
from app.services.tenant import TenantScope, tenant_scope_from_token_payload
from app.websockets.manager import manager

router = APIRouter()

_DRIVER_WS_ROLES = {Role.driver.value, Role.customer_admin.value, Role.product_admin.value}
_ADMIN_WS_ROLES = {Role.customer_admin.value, Role.product_admin.value}


async def _auth_ws(websocket: WebSocket) -> tuple[dict, TenantScope] | tuple[None, None]:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return None, None
    try:
        payload = decode_token(token)
    except Exception:
        await websocket.close(code=4401)
        return None, None
    try:
        scope = await tenant_scope_from_token_payload(payload)
    except HTTPException as exc:
        code = 4403 if exc.status_code == 403 else 4401
        await websocket.close(code=code)
        return None, None
    return payload, scope


@router.websocket("/ws/driver/{bus_id}")
async def driver_ws(websocket: WebSocket, bus_id: str) -> None:
    payload, scope = await _auth_ws(websocket)
    if payload is None or scope is None:
        return
    if payload.get("role") not in _DRIVER_WS_ROLES:
        await websocket.close(code=4403)
        return

    bus = None
    if ObjectId.is_valid(bus_id):
        bus = await get_db().buses.find_one(scope.mongo_filter({"_id": ObjectId(bus_id)}))
    if not bus:
        await websocket.close(code=4404)
        return
    if payload.get("role") == Role.driver.value and bus.get("driver_id") != payload.get("sub"):
        await websocket.close(code=4403)
        return

    await manager.connect_driver(bus_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            update = LocationUpdate(
                bus_id=bus_id,
                lat=float(data["lat"]),
                lng=float(data["lng"]),
                speed=data.get("speed"),
                recorded_at=data["recorded_at"],
            )
            bus_doc = await apply_location_update(update)
            await websocket.send_json({"ok": True, "bus": bus_doc})
    except WebSocketDisconnect:
        manager.disconnect_driver(bus_id, websocket)
    except Exception as exc:
        try:
            await websocket.send_json({"ok": False, "error": str(exc)})
        except Exception:
            pass
        manager.disconnect_driver(bus_id, websocket)


@router.websocket("/ws/track/{bus_id}")
async def track_ws(websocket: WebSocket, bus_id: str) -> None:
    _payload, scope = await _auth_ws(websocket)
    if _payload is None or scope is None:
        return
    bus = None
    if ObjectId.is_valid(bus_id):
        bus = await get_db().buses.find_one(scope.mongo_filter({"_id": ObjectId(bus_id)}))
    if not bus:
        await websocket.close(code=4404)
        return
    await manager.connect_tracker(bus_id, websocket)
    try:
        await websocket.send_json({"type": "location", "bus": enrich_bus(bus)})
        while True:
            await websocket.receive_text()  # keep-alive / ignore client messages
    except WebSocketDisconnect:
        manager.disconnect_tracker(bus_id, websocket)


@router.websocket("/ws/admin")
async def admin_ws(websocket: WebSocket) -> None:
    payload, _scope = await _auth_ws(websocket)
    if payload is None or _scope is None:
        return
    if payload.get("role") not in _ADMIN_WS_ROLES:
        await websocket.close(code=4403)
        return
    await manager.connect_admin(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)

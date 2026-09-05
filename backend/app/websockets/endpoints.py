import json

from bson import ObjectId
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import get_db
from app.models.schemas import LocationUpdate
from app.services.auth_service import decode_token
from app.services.location_service import apply_location_update
from app.websockets.manager import manager

router = APIRouter()


async def _auth_ws(websocket: WebSocket) -> dict | None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401)
        return None
    try:
        return decode_token(token)
    except Exception:
        await websocket.close(code=4401)
        return None


@router.websocket("/ws/driver/{bus_id}")
async def driver_ws(websocket: WebSocket, bus_id: str) -> None:
    payload = await _auth_ws(websocket)
    if payload is None:
        return
    if payload.get("role") not in ("driver", "admin"):
        await websocket.close(code=4403)
        return

    bus = await get_db().buses.find_one({"_id": ObjectId(bus_id)}) if ObjectId.is_valid(bus_id) else None
    if not bus:
        await websocket.close(code=4404)
        return
    if payload.get("role") == "driver" and bus.get("driver_id") != payload.get("sub"):
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
    payload = await _auth_ws(websocket)
    if payload is None:
        return
    await manager.connect_tracker(bus_id, websocket)
    try:
        # Send current snapshot
        if ObjectId.is_valid(bus_id):
            from app.services.location_service import enrich_bus

            bus = await get_db().buses.find_one({"_id": ObjectId(bus_id)})
            if bus:
                await websocket.send_json({"type": "location", "bus": enrich_bus(bus)})
        while True:
            await websocket.receive_text()  # keep-alive / ignore client messages
    except WebSocketDisconnect:
        manager.disconnect_tracker(bus_id, websocket)


@router.websocket("/ws/admin")
async def admin_ws(websocket: WebSocket) -> None:
    payload = await _auth_ws(websocket)
    if payload is None:
        return
    if payload.get("role") != "admin":
        await websocket.close(code=4403)
        return
    await manager.connect_admin(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)

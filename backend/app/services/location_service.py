from datetime import datetime, timezone
from typing import Any, Optional

from bson import ObjectId

from app.config import settings
from app.database import get_db
from app.models.schemas import BusStatus, LocationUpdate, doc_id
from app.services.alert_engine import process_location_for_alerts
from app.websockets.manager import manager


def compute_is_stale(last_updated_at: Optional[datetime]) -> bool:
    if last_updated_at is None:
        return True
    ts = last_updated_at
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - ts).total_seconds()
    return age > settings.stale_seconds


def enrich_bus(doc: dict) -> dict:
    bus = doc_id(doc)
    bus["is_stale"] = compute_is_stale(doc.get("last_updated_at"))
    return bus


async def apply_location_update(payload: LocationUpdate) -> dict[str, Any]:
    """Shared path for WebSocket + REST: update bus, broadcast, run alert engine."""
    db = get_db()
    if not ObjectId.is_valid(payload.bus_id):
        raise ValueError("Invalid bus_id")

    bus = await db.buses.find_one({"_id": ObjectId(payload.bus_id)})
    if not bus:
        raise ValueError("Bus not found")

    now = datetime.now(timezone.utc)
    recorded = payload.recorded_at
    if recorded.tzinfo is None:
        recorded = recorded.replace(tzinfo=timezone.utc)

    # Ignore older points — latest only
    last = bus.get("last_updated_at")
    if last is not None:
        last_cmp = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
        if recorded < last_cmp:
            return enrich_bus(bus)

    update_fields: dict[str, Any] = {
        "current_lat": payload.lat,
        "current_lng": payload.lng,
        "last_updated_at": recorded,
        "last_speed": payload.speed,
        "status": BusStatus.active.value,
        "trip_active": True,
    }

    alert_patch = await process_location_for_alerts(
        bus=bus,
        lat=payload.lat,
        lng=payload.lng,
        speed_mps=payload.speed,
    )
    update_fields.update(alert_patch)

    await db.buses.update_one({"_id": bus["_id"]}, {"$set": update_fields})
    updated = await db.buses.find_one({"_id": bus["_id"]})
    enriched = enrich_bus(updated)

    await manager.broadcast_bus(
        payload.bus_id,
        {
            "type": "location",
            "bus": enriched,
            "lat": payload.lat,
            "lng": payload.lng,
            "speed": payload.speed,
            "recorded_at": recorded.isoformat(),
        },
    )
    return enriched


async def mark_signal_lost_if_needed(bus_id: str) -> None:
    db = get_db()
    bus = await db.buses.find_one({"_id": ObjectId(bus_id)})
    if not bus or not bus.get("trip_active"):
        return
    last = bus.get("last_updated_at")
    if last is None:
        return
    last_cmp = last if last.tzinfo else last.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - last_cmp).total_seconds()
    if age > settings.signal_lost_seconds and bus.get("status") != BusStatus.signal_lost.value:
        await db.buses.update_one(
            {"_id": bus["_id"]},
            {"$set": {"status": BusStatus.signal_lost.value}},
        )
        updated = enrich_bus(await db.buses.find_one({"_id": bus["_id"]}))
        await manager.notify_admins({"type": "signal_lost", "bus": updated})
        await manager.broadcast_bus(bus_id, {"type": "location", "bus": updated})

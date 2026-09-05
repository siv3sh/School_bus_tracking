"""Notify parents when the bus reaches the school (last stop)."""

from datetime import datetime, timezone

from bson import ObjectId

from app.database import get_db
from app.services.push_service import send_push_notifications


def is_school_stop(route: dict, stop: dict) -> bool:
    stops = sorted(route.get("stops") or [], key=lambda s: s.get("sequence_number", 0))
    if not stops or not stop:
        return False
    last = stops[-1]
    if stop.get("stop_id") == last.get("stop_id"):
        return True
    name = (stop.get("name") or "").lower()
    return "school" in name


async def notify_school_arrived(*, bus: dict, route: dict, stop: dict) -> int:
    """Push + alert_log once per parent per trip when the school stop is reached."""
    if not is_school_stop(route, stop):
        return 0

    db = get_db()
    bus_id = str(bus["_id"])
    trip_id = bus.get("current_trip_id")
    students = await db.students.find({"route_id": str(route["_id"])}).to_list(500)
    parent_ids = {s["parent_id"] for s in students if s.get("parent_id")}
    if not parent_ids:
        return 0

    parents = await db.users.find(
        {"_id": {"$in": [ObjectId(pid) for pid in parent_ids if ObjectId.is_valid(pid)]}}
    ).to_list(500)

    now = datetime.now(timezone.utc)
    school_name = stop.get("name") or "school"
    notified = 0
    for parent in parents:
        parent_id = str(parent["_id"])
        existing = await db.alert_logs.find_one(
            {
                "bus_id": bus_id,
                "trip_id": trip_id,
                "parent_id": parent_id,
                "type": "school_arrived",
            }
        )
        if existing:
            continue

        token = parent.get("expo_push_token")
        title = "Arrived at school"
        body = f"The bus has reached {school_name}."
        if token:
            send_push_notifications(
                [token],
                title,
                body,
                data={"bus_id": bus_id, "type": "school_arrived", "stop_id": stop.get("stop_id")},
            )

        await db.alert_logs.insert_one(
            {
                "bus_id": bus_id,
                "stop_id": stop.get("stop_id"),
                "parent_id": parent_id,
                "sent_at": now,
                "type": "school_arrived",
                "trip_id": trip_id,
                "message": body,
            }
        )
        notified += 1
    return notified

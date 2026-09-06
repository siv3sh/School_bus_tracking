"""Proximity / ETA alert engine — isolated from WebSocket/REST handlers."""

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from app.config import settings
from app.database import get_db
from app.services.eta_service import estimate_eta_minutes
from app.services.push_service import send_push_notifications
from app.services.school_arrival import notify_school_arrived
from app.services.tenant import school_filter


def _sorted_stops(route: dict) -> list[dict]:
    return sorted(route.get("stops") or [], key=lambda s: s.get("sequence_number", 0))


def _next_unvisited(route: dict, next_seq: int) -> dict | None:
    for stop in _sorted_stops(route):
        if stop.get("sequence_number", 0) >= next_seq and not stop.get("reached"):
            return stop
    return None


async def process_location_for_alerts(
    *,
    bus: dict,
    lat: float,
    lng: float,
    speed_mps: float | None,
) -> dict[str, Any]:
    """
    Evaluate alerts against the latest point only.
    Marks stops reached within ~150m and may send ETA warning pushes per parent preference.
    """
    db = get_db()
    patch: dict[str, Any] = {}
    route_id = bus.get("route_id")
    if not route_id:
        return patch

    customer_id = bus.get("customer_id")
    route = await db.routes.find_one(school_filter(customer_id, {"_id": ObjectId(route_id)}))
    if not route:
        return patch

    next_seq = int(bus.get("next_stop_sequence") or 1)
    trip_id = bus.get("current_trip_id")
    stop = _next_unvisited(route, next_seq)
    if not stop:
        return patch

    eta = estimate_eta_minutes(lat, lng, stop["lat"], stop["lng"], speed_mps)
    distance_m = float(eta["distance_m"])
    minutes = eta["eta_minutes"]
    if minutes is None:
        return patch

    if distance_m <= settings.stop_reached_meters:
        await db.routes.update_one(
            school_filter(customer_id, {"_id": route["_id"], "stops.stop_id": stop["stop_id"]}),
            {"$set": {"stops.$.reached": True}},
        )
        patch["next_stop_sequence"] = int(stop["sequence_number"]) + 1
        await notify_school_arrived(bus=bus, route=route, stop=stop)
        return patch

    students = await db.students.find(
        school_filter(customer_id, {"stop_id": stop["stop_id"], "route_id": str(route["_id"])})
    ).to_list(500)
    parent_ids = {s["parent_id"] for s in students}
    if not parent_ids:
        return patch

    parents = await db.users.find(
        school_filter(
            customer_id,
            {"_id": {"$in": [ObjectId(pid) for pid in parent_ids if ObjectId.is_valid(pid)]}},
        )
    ).to_list(500)

    now = datetime.now(timezone.utc)
    for parent in parents:
        pref = int(parent.get("alert_minutes_before") or settings.eta_alert_minutes)
        if minutes > pref:
            continue

        alert_filter = {
            "bus_id": str(bus["_id"]),
            "stop_id": stop["stop_id"],
            "type": "eta_warning",
            "trip_id": trip_id,
            "parent_id": str(parent["_id"]),
            "pref_minutes": pref,
        }
        existing = await db.alert_logs.find_one(
            school_filter(
                customer_id,
                {
                    "bus_id": str(bus["_id"]),
                    "stop_id": stop["stop_id"],
                    "trip_id": trip_id,
                    "parent_id": str(parent["_id"]),
                    "type": {"$in": ["eta_warning", "5_min_warning"]},
                },
            )
        )
        if existing:
            continue

        token = parent.get("expo_push_token")
        title = "Bus almost here"
        body = f"About {int(max(minutes, 1))} min from {stop['name']}"
        if token:
            send_push_notifications([token], title, body, data={"bus_id": str(bus["_id"]), "stop_id": stop["stop_id"]})

        await db.alert_logs.insert_one(
            {
                **alert_filter,
                "sent_at": now,
                "type": "5_min_warning" if pref == 5 else "eta_warning",
                "customer_id": customer_id,
            }
        )

    return patch

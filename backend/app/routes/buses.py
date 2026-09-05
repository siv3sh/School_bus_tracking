from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.models.schemas import (
    BoardStudentRequest,
    BroadcastRequest,
    BusPublic,
    Role,
    StudentPublic,
    UserPublic,
    doc_id,
)
from app.services.audit_service import write_audit
from app.services.auth_service import get_current_user, require_roles
from app.services.location_service import enrich_bus
from app.services.push_service import send_push_notifications
from app.services.school_arrival import notify_school_arrived
from app.websockets.manager import manager

router = APIRouter(prefix="/api/buses", tags=["buses"])


async def _push_bus_snapshot(bus_id: str, bus_doc: dict | None, event: str = "bus_update") -> dict:
    """Notify parent/admin trackers so trip actions show up without waiting for GPS."""
    if not bus_doc:
        return {}
    payload = enrich_bus(bus_doc)
    await manager.broadcast_bus(bus_id, {"type": event, "bus": payload})
    return payload


def _next_stop(route: dict | None, next_seq: int) -> dict | None:
    if not route:
        return None
    stops = sorted(route.get("stops") or [], key=lambda s: s.get("sequence_number", 0))
    for s in stops:
        if s.get("sequence_number", 0) >= next_seq and not s.get("reached"):
            return s
    return None


@router.get("", response_model=list[BusPublic])
async def list_buses(_user: UserPublic = Depends(require_roles(Role.admin))) -> list[dict]:
    docs = await get_db().buses.find().to_list(200)
    return [BusPublic(**enrich_bus(d)) for d in docs]


@router.get("/mine")
async def my_bus(user: UserPublic = Depends(require_roles(Role.driver))) -> dict:
    db = get_db()
    bus = await db.buses.find_one({"driver_id": user.id})
    if not bus:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No bus assigned")
    enriched = enrich_bus(bus)
    route = None
    students: list[dict] = []
    if bus.get("route_id") and ObjectId.is_valid(bus["route_id"]):
        route_doc = await db.routes.find_one({"_id": ObjectId(bus["route_id"])})
        if route_doc:
            route = doc_id(route_doc)
            students_raw = await db.students.find({"route_id": str(route_doc["_id"])}).to_list(200)
            students = [StudentPublic(**{**doc_id(s), "boarded": bool(s.get("boarded"))}).model_dump() for s in students_raw]
    next_stop = _next_stop(route, int(bus.get("next_stop_sequence") or 1))
    return {
        "bus": BusPublic(**enriched),
        "route": route,
        "next_stop": next_stop,
        "students": students,
    }


@router.get("/{bus_id}", response_model=BusPublic)
async def get_bus(bus_id: str, _user: UserPublic = Depends(get_current_user)) -> BusPublic:
    if not ObjectId.is_valid(bus_id):
        raise HTTPException(status_code=400, detail="Invalid bus id")
    bus = await get_db().buses.find_one({"_id": ObjectId(bus_id)})
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    return BusPublic(**enrich_bus(bus))


@router.post("/{bus_id}/start-trip")
async def start_trip(bus_id: str, user: UserPublic = Depends(require_roles(Role.driver, Role.admin))) -> dict:
    db = get_db()
    bus = await db.buses.find_one({"_id": ObjectId(bus_id)})
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    if user.role == Role.driver and bus.get("driver_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your bus")

    trip_id = str(ObjectId())
    if bus.get("route_id") and ObjectId.is_valid(bus["route_id"]):
        route = await db.routes.find_one({"_id": ObjectId(bus["route_id"])})
        if route:
            stops = route.get("stops") or []
            for s in stops:
                s["reached"] = False
            await db.routes.update_one({"_id": route["_id"]}, {"$set": {"stops": stops}})
            await db.students.update_many({"route_id": str(route["_id"])}, {"$set": {"boarded": False}})

    await db.buses.update_one(
        {"_id": bus["_id"]},
        {
            "$set": {
                "trip_active": True,
                "status": "active",
                "current_trip_id": trip_id,
                "next_stop_sequence": 1,
            }
        },
    )
    await write_audit(
        actor_id=user.id,
        actor_role=user.role.value,
        action="start_trip",
        bus_id=bus_id,
        meta={"trip_id": trip_id},
    )
    updated = await db.buses.find_one({"_id": bus["_id"]})
    enriched = await _push_bus_snapshot(bus_id, updated, event="trip_started")
    return {"ok": True, "trip_id": trip_id, "bus": BusPublic(**enriched)}


@router.post("/{bus_id}/end-trip")
async def end_trip(bus_id: str, user: UserPublic = Depends(require_roles(Role.driver, Role.admin))) -> dict:
    db = get_db()
    bus = await db.buses.find_one({"_id": ObjectId(bus_id)})
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    if user.role == Role.driver and bus.get("driver_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your bus")
    await db.buses.update_one(
        {"_id": bus["_id"]},
        {"$set": {"trip_active": False, "status": "inactive", "current_trip_id": None}},
    )
    await write_audit(actor_id=user.id, actor_role=user.role.value, action="end_trip", bus_id=bus_id)
    updated = await db.buses.find_one({"_id": bus["_id"]})
    enriched = await _push_bus_snapshot(bus_id, updated, event="trip_ended")
    return {"ok": True, "bus": BusPublic(**enriched)}


@router.post("/{bus_id}/mark-stop-reached")
async def mark_stop_reached(bus_id: str, user: UserPublic = Depends(require_roles(Role.driver, Role.admin))) -> dict:
    db = get_db()
    bus = await db.buses.find_one({"_id": ObjectId(bus_id)})
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    if user.role == Role.driver and bus.get("driver_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your bus")
    if not bus.get("route_id"):
        raise HTTPException(status_code=400, detail="No route")
    route = await db.routes.find_one({"_id": ObjectId(bus["route_id"])})
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    next_seq = int(bus.get("next_stop_sequence") or 1)
    stop = _next_stop(route, next_seq)
    if not stop:
        return {"ok": True, "message": "No more stops", "bus": BusPublic(**enrich_bus(bus))}
    await db.routes.update_one(
        {"_id": route["_id"], "stops.stop_id": stop["stop_id"]},
        {"$set": {"stops.$.reached": True}},
    )
    await db.buses.update_one(
        {"_id": bus["_id"]},
        {"$set": {"next_stop_sequence": int(stop["sequence_number"]) + 1}},
    )
    await write_audit(
        actor_id=user.id,
        actor_role=user.role.value,
        action="mark_stop_reached",
        bus_id=bus_id,
        meta={"stop_id": stop["stop_id"], "stop_name": stop.get("name")},
    )
    await notify_school_arrived(bus=bus, route=route, stop=stop)
    updated = await db.buses.find_one({"_id": bus["_id"]})
    route2 = doc_id(await db.routes.find_one({"_id": route["_id"]}))
    enriched = await _push_bus_snapshot(bus_id, updated, event="stop_reached")
    return {
        "ok": True,
        "bus": BusPublic(**enriched),
        "route": route2,
        "next_stop": _next_stop(route2, int(updated.get("next_stop_sequence") or 1)),
    }


@router.post("/{bus_id}/broadcast")
async def broadcast(
    bus_id: str,
    body: BroadcastRequest,
    user: UserPublic = Depends(require_roles(Role.driver, Role.admin)),
) -> dict:
    if body.type not in ("delay", "emergency"):
        raise HTTPException(status_code=400, detail="type must be delay or emergency")
    db = get_db()
    bus = await db.buses.find_one({"_id": ObjectId(bus_id)})
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    if user.role == Role.driver and bus.get("driver_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your bus")

    students = await db.students.find({"route_id": bus.get("route_id")}).to_list(500)
    parent_ids = {s["parent_id"] for s in students}
    parents = await db.users.find(
        {"_id": {"$in": [ObjectId(pid) for pid in parent_ids if ObjectId.is_valid(pid)]}}
    ).to_list(500)
    tokens = [p.get("expo_push_token") for p in parents if p.get("expo_push_token")]
    title = "Emergency" if body.type == "emergency" else "Bus delay"
    send_push_notifications(tokens, title, body.message, data={"bus_id": bus_id, "type": body.type})

    now = datetime.now(timezone.utc)
    for parent in parents:
        await db.alert_logs.insert_one(
            {
                "bus_id": bus_id,
                "stop_id": "",
                "parent_id": str(parent["_id"]),
                "sent_at": now,
                "type": body.type,
                "trip_id": bus.get("current_trip_id"),
                "message": body.message,
            }
        )

    await write_audit(
        actor_id=user.id,
        actor_role=user.role.value,
        action=f"broadcast_{body.type}",
        bus_id=bus_id,
        meta={"message": body.message},
    )
    await manager.notify_admins({"type": body.type, "bus_id": bus_id, "message": body.message})
    return {"ok": True, "notified": len(tokens)}


@router.post("/{bus_id}/board-student")
async def board_student(
    bus_id: str,
    body: BoardStudentRequest,
    user: UserPublic = Depends(require_roles(Role.driver, Role.admin)),
) -> dict:
    db = get_db()
    bus = await db.buses.find_one({"_id": ObjectId(bus_id)})
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    if user.role == Role.driver and bus.get("driver_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your bus")
    if not ObjectId.is_valid(body.student_id):
        raise HTTPException(status_code=400, detail="Invalid student id")
    student = await db.students.find_one({"_id": ObjectId(body.student_id)})
    if not student or student.get("route_id") != bus.get("route_id"):
        raise HTTPException(status_code=404, detail="Student not on this bus route")
    await db.students.update_one({"_id": student["_id"]}, {"$set": {"boarded": body.boarded}})
    await write_audit(
        actor_id=user.id,
        actor_role=user.role.value,
        action="board_student" if body.boarded else "unboard_student",
        bus_id=bus_id,
        meta={"student_id": body.student_id, "name": student.get("name")},
    )
    updated = await db.students.find_one({"_id": student["_id"]})
    # Notify parents so they can refresh boarded / trip state
    await _push_bus_snapshot(bus_id, await db.buses.find_one({"_id": bus["_id"]}), event="student_boarded")
    return {"ok": True, "student": StudentPublic(**{**doc_id(updated), "boarded": bool(updated.get("boarded"))})}

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.models.schemas import (
    BoardStudentRequest,
    BroadcastRequest,
    BusPublic,
    FLEET_ROLES,
    Role,
    SCHOOL_OPERATOR_ROLES,
    StudentPublic,
    UserPublic,
    doc_id,
)
from app.services.audit_service import write_scope_audit
from app.services.auth_service import get_current_user, require_roles
from app.services.invite_service import as_object_id
from app.services.location_service import enrich_bus
from app.services.push_service import send_push_notifications
from app.services.school_arrival import notify_school_arrived
from app.services.tenant import TenantScope, get_tenant_scope
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
async def list_buses(
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> list[dict]:
    docs = await get_db().buses.find(scope.mongo_filter()).to_list(200)
    return [BusPublic(**enrich_bus(d)) for d in docs]


@router.get("/mine")
async def my_bus(
    user: UserPublic = Depends(require_roles(Role.driver)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> dict:
    db = get_db()
    bus = await db.buses.find_one(scope.mongo_filter({"driver_id": user.id}))
    if not bus:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No bus assigned")
    enriched = enrich_bus(bus)
    route = None
    students: list[dict] = []
    if bus.get("route_id") and ObjectId.is_valid(bus["route_id"]):
        route_doc = await db.routes.find_one(scope.mongo_filter({"_id": ObjectId(bus["route_id"])}))
        if route_doc:
            route = doc_id(route_doc)
            students_raw = await db.students.find(scope.mongo_filter({"route_id": str(route_doc["_id"])})).to_list(200)
            students = [StudentPublic(**{**doc_id(s), "boarded": bool(s.get("boarded"))}).model_dump() for s in students_raw]
    next_stop = _next_stop(route, int(bus.get("next_stop_sequence") or 1))
    return {
        "bus": BusPublic(**enriched),
        "route": route,
        "next_stop": next_stop,
        "students": students,
    }


@router.get("/{bus_id}", response_model=BusPublic)
async def get_bus(
    bus_id: str,
    _user: UserPublic = Depends(get_current_user),
    scope: TenantScope = Depends(get_tenant_scope),
) -> BusPublic:
    bus = await get_db().buses.find_one(scope.mongo_filter({"_id": as_object_id(bus_id, "bus_id")}))
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    return BusPublic(**enrich_bus(bus))


async def _load_owned_bus(bus_id: str, user: UserPublic, scope: TenantScope) -> dict:
    bus = await get_db().buses.find_one(scope.mongo_filter({"_id": as_object_id(bus_id, "bus_id")}))
    if not bus:
        raise HTTPException(status_code=404, detail="Bus not found")
    if user.role == Role.driver and bus.get("driver_id") != user.id:
        raise HTTPException(status_code=403, detail="Not your bus")
    return bus


@router.post("/{bus_id}/start-trip")
async def start_trip(
    bus_id: str,
    user: UserPublic = Depends(require_roles(*FLEET_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> dict:
    db = get_db()
    bus = await _load_owned_bus(bus_id, user, scope)
    trip_id = str(ObjectId())
    if bus.get("route_id") and ObjectId.is_valid(bus["route_id"]):
        route = await db.routes.find_one(scope.mongo_filter({"_id": ObjectId(bus["route_id"])}))
        if route:
            stops = route.get("stops") or []
            for s in stops:
                s["reached"] = False
            await db.routes.update_one(scope.mongo_filter({"_id": route["_id"]}), {"$set": {"stops": stops}})
            await db.students.update_many(
                scope.mongo_filter({"route_id": str(route["_id"])}),
                {"$set": {"boarded": False}},
            )

    await db.buses.update_one(
        scope.mongo_filter({"_id": bus["_id"]}),
        {
            "$set": {
                "trip_active": True,
                "status": "active",
                "current_trip_id": trip_id,
                "next_stop_sequence": 1,
            }
        },
    )
    await write_scope_audit(scope, action="start_trip", target_type="bus", target_id=bus_id)
    updated = await db.buses.find_one(scope.mongo_filter({"_id": bus["_id"]}))
    enriched = await _push_bus_snapshot(bus_id, updated, event="trip_started")
    return {"ok": True, "trip_id": trip_id, "bus": BusPublic(**enriched)}


@router.post("/{bus_id}/end-trip")
async def end_trip(
    bus_id: str,
    user: UserPublic = Depends(require_roles(*FLEET_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> dict:
    db = get_db()
    bus = await _load_owned_bus(bus_id, user, scope)
    await db.buses.update_one(
        scope.mongo_filter({"_id": bus["_id"]}),
        {"$set": {"trip_active": False, "status": "inactive", "current_trip_id": None}},
    )
    await write_scope_audit(scope, action="end_trip", target_type="bus", target_id=bus_id)
    updated = await db.buses.find_one(scope.mongo_filter({"_id": bus["_id"]}))
    enriched = await _push_bus_snapshot(bus_id, updated, event="trip_ended")
    return {"ok": True, "bus": BusPublic(**enriched)}


@router.post("/{bus_id}/mark-stop-reached")
async def mark_stop_reached(
    bus_id: str,
    user: UserPublic = Depends(require_roles(*FLEET_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> dict:
    db = get_db()
    bus = await _load_owned_bus(bus_id, user, scope)
    if not bus.get("route_id"):
        raise HTTPException(status_code=400, detail="No route")
    route = await db.routes.find_one(scope.mongo_filter({"_id": ObjectId(bus["route_id"])}))
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    next_seq = int(bus.get("next_stop_sequence") or 1)
    stop = _next_stop(route, next_seq)
    if not stop:
        return {"ok": True, "message": "No more stops", "bus": BusPublic(**enrich_bus(bus))}
    await db.routes.update_one(
        scope.mongo_filter({"_id": route["_id"], "stops.stop_id": stop["stop_id"]}),
        {"$set": {"stops.$.reached": True}},
    )
    await db.buses.update_one(
        scope.mongo_filter({"_id": bus["_id"]}),
        {"$set": {"next_stop_sequence": int(stop["sequence_number"]) + 1}},
    )
    await write_scope_audit(scope, action="mark_stop_reached", target_type="bus", target_id=bus_id)
    await notify_school_arrived(bus=bus, route=route, stop=stop)
    updated = await db.buses.find_one(scope.mongo_filter({"_id": bus["_id"]}))
    route2 = doc_id(await db.routes.find_one(scope.mongo_filter({"_id": route["_id"]})))
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
    user: UserPublic = Depends(require_roles(*FLEET_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> dict:
    if body.type not in ("delay", "emergency"):
        raise HTTPException(status_code=400, detail="type must be delay or emergency")
    db = get_db()
    bus = await _load_owned_bus(bus_id, user, scope)

    students = await db.students.find(scope.mongo_filter({"route_id": bus.get("route_id")})).to_list(500)
    parent_ids = {s["parent_id"] for s in students}
    parents = await db.users.find(
        scope.mongo_filter({"_id": {"$in": [ObjectId(pid) for pid in parent_ids if ObjectId.is_valid(pid)]}})
    ).to_list(500)
    tokens = [p.get("expo_push_token") for p in parents if p.get("expo_push_token")]
    title = "Emergency" if body.type == "emergency" else "Bus delay"
    send_push_notifications(tokens, title, body.message, data={"bus_id": bus_id, "type": body.type})

    now = datetime.now(timezone.utc)
    customer_id = bus.get("customer_id") or scope.customer_id
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
                "customer_id": customer_id,
            }
        )

    await write_scope_audit(scope, action=f"broadcast_{body.type}", target_type="bus", target_id=bus_id)
    await manager.notify_admins({"type": body.type, "bus_id": bus_id, "message": body.message})
    return {"ok": True, "notified": len(tokens)}


@router.post("/{bus_id}/board-student")
async def board_student(
    bus_id: str,
    body: BoardStudentRequest,
    user: UserPublic = Depends(require_roles(*FLEET_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> dict:
    db = get_db()
    bus = await _load_owned_bus(bus_id, user, scope)
    student = await db.students.find_one(scope.mongo_filter({"_id": as_object_id(body.student_id, "student_id")}))
    if not student or student.get("route_id") != bus.get("route_id"):
        raise HTTPException(status_code=404, detail="Student not on this bus route")
    await db.students.update_one(scope.mongo_filter({"_id": student["_id"]}), {"$set": {"boarded": body.boarded}})
    await write_scope_audit(
        scope,
        action="board_student" if body.boarded else "unboard_student",
        target_type="student",
        target_id=body.student_id,
    )
    updated = await db.students.find_one(scope.mongo_filter({"_id": student["_id"]}))
    await _push_bus_snapshot(bus_id, await db.buses.find_one(scope.mongo_filter({"_id": bus["_id"]})), event="student_boarded")
    return {"ok": True, "student": StudentPublic(**{**doc_id(updated), "boarded": bool(updated.get("boarded"))})}

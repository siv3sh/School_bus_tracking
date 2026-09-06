from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.schemas import (
    AlertLogPublic,
    BoardedUpdate,
    Role,
    StudentPublic,
    UserPublic,
    doc_id,
)
from app.services.audit_service import write_scope_audit
from app.services.auth_service import require_roles
from app.services.eta_service import estimate_eta_minutes
from app.services.invite_service import as_object_id
from app.services.location_service import enrich_bus
from app.services.tenant import TenantScope, get_tenant_scope
from app.websockets.manager import manager

router = APIRouter(prefix="/api/parent", tags=["parent"])


@router.get("/children")
async def my_children(
    user: UserPublic = Depends(require_roles(Role.parent)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> list[dict]:
    db = get_db()
    students = await db.students.find(scope.mongo_filter({"parent_id": user.id})).to_list(50)
    result = []
    for s in students:
        student = StudentPublic(**{**doc_id(s), "boarded": bool(s.get("boarded"))})
        bus = await db.buses.find_one(scope.mongo_filter({"route_id": s["route_id"]}))
        route = None
        if ObjectId.is_valid(s["route_id"]):
            route = await db.routes.find_one(scope.mongo_filter({"_id": ObjectId(s["route_id"])}))
        stop = None
        eta = None
        school_arrived = False
        if route:
            stop = next((st for st in route.get("stops", []) if st.get("stop_id") == s["stop_id"]), None)
            stops_sorted = sorted(route.get("stops") or [], key=lambda st: st.get("sequence_number", 0))
            last = stops_sorted[-1] if stops_sorted else None
            school_arrived = bool(last and last.get("reached"))
            route = doc_id(route)
        enriched_bus = enrich_bus(bus) if bus else None
        if enriched_bus and stop and enriched_bus.get("current_lat") is not None and enriched_bus.get("current_lng") is not None:
            target = stop
            if student.boarded and route:
                stops = sorted(route.get("stops") or [], key=lambda st: st.get("sequence_number", 0))
                if stops:
                    target = stops[-1]
            eta = estimate_eta_minutes(
                enriched_bus["current_lat"],
                enriched_bus["current_lng"],
                target["lat"],
                target["lng"],
                enriched_bus.get("last_speed"),
            )
            if student.boarded and target:
                eta = {**eta, "target": "school", "target_name": target.get("name")}
            else:
                eta = {**eta, "target": "stop", "target_name": stop.get("name") if stop else None}
        result.append(
            {
                "student": student,
                "bus": enriched_bus,
                "route": route,
                "stop": stop,
                "eta": eta,
                "school_arrived": school_arrived,
            }
        )
    return result


@router.post("/students/{student_id}/board")
async def parent_set_boarded(
    student_id: str,
    body: BoardedUpdate,
    user: UserPublic = Depends(require_roles(Role.parent)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> dict:
    """Parent confirms their child boarded (or unboards)."""
    db = get_db()
    student = await db.students.find_one(scope.mongo_filter({"_id": as_object_id(student_id, "student_id")}))
    if not student or student.get("parent_id") != user.id:
        raise HTTPException(status_code=404, detail="Student not found")

    boarded = bool(body.boarded)
    await db.students.update_one(scope.mongo_filter({"_id": student["_id"]}), {"$set": {"boarded": boarded}})
    bus = await db.buses.find_one(scope.mongo_filter({"route_id": student.get("route_id")}))
    bus_id = str(bus["_id"]) if bus else None
    await write_scope_audit(
        scope,
        action="parent_board_student" if boarded else "parent_unboard_student",
        target_type="student",
        target_id=student_id,
    )
    if bus_id and bus:
        await manager.broadcast_bus(
            bus_id,
            {"type": "student_boarded", "bus": enrich_bus(bus), "student_id": student_id, "boarded": boarded},
        )
    updated = await db.students.find_one(scope.mongo_filter({"_id": student["_id"]}))
    return {"ok": True, "student": StudentPublic(**{**doc_id(updated), "boarded": bool(updated.get("boarded"))})}


@router.get("/alerts", response_model=list[AlertLogPublic])
async def my_alerts(
    user: UserPublic = Depends(require_roles(Role.parent)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> list[AlertLogPublic]:
    docs = await get_db().alert_logs.find(scope.mongo_filter({"parent_id": user.id})).sort("sent_at", -1).to_list(200)
    return [AlertLogPublic(**doc_id(d)) for d in docs]

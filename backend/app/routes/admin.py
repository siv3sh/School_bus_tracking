from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.schemas import (
    AlertLogPublic,
    AuditLogPublic,
    BusAssign,
    BusCreate,
    BusPublic,
    Role,
    RouteCreate,
    RoutePublic,
    SCHOOL_OPERATOR_ROLES,
    StopEmbedded,
    StudentCreate,
    StudentPublic,
    UserPublic,
    doc_id,
    user_from_doc,
)
from app.services.audit_service import write_scope_audit
from app.services.auth_service import require_roles
from app.services.invite_service import as_object_id
from app.services.location_service import enrich_bus
from app.services.tenant import TenantScope, get_tenant_scope

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _stop_docs(body_stops: list[StopEmbedded]) -> list[dict]:
    stops = []
    for i, stop in enumerate(body_stops):
        stop_id = stop.stop_id or str(ObjectId())
        stops.append(
            StopEmbedded(
                stop_id=stop_id,
                name=stop.name,
                lat=stop.lat,
                lng=stop.lng,
                sequence_number=stop.sequence_number or i + 1,
                reached=stop.reached,
            ).model_dump()
        )
    return stops


@router.get("/routes", response_model=list[RoutePublic])
async def list_routes(
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> list[RoutePublic]:
    docs = await get_db().routes.find(scope.mongo_filter()).to_list(200)
    out: list[RoutePublic] = []
    for d in docs:
        payload = doc_id(d)
        payload.setdefault("schedule", "morning")
        out.append(RoutePublic(**payload))
    return out


@router.post("/routes", response_model=RoutePublic)
async def create_route(
    body: RouteCreate,
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> RoutePublic:
    customer_id = scope.require_customer_id()
    doc = {
        "name": body.name,
        "stops": _stop_docs(body.stops),
        "schedule": body.schedule.value,
        "customer_id": customer_id,
        "created_at": datetime.now(timezone.utc),
    }
    result = await get_db().routes.insert_one(doc)
    created = await get_db().routes.find_one(scope.mongo_filter({"_id": result.inserted_id}))
    await write_scope_audit(scope, action="create_route", target_type="route", target_id=str(result.inserted_id))
    return RoutePublic(**doc_id(created))


@router.put("/routes/{route_id}", response_model=RoutePublic)
async def update_route(
    route_id: str,
    body: RouteCreate,
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> RoutePublic:
    route_oid = as_object_id(route_id, "route_id")
    existing = await get_db().routes.find_one(scope.mongo_filter({"_id": route_oid}))
    if not existing:
        raise HTTPException(status_code=404, detail="Route not found")
    await get_db().routes.update_one(
        scope.mongo_filter({"_id": route_oid}),
        {
            "$set": {
                "name": body.name,
                "stops": _stop_docs(body.stops),
                "schedule": body.schedule.value,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    updated = await get_db().routes.find_one(scope.mongo_filter({"_id": route_oid}))
    await write_scope_audit(scope, action="update_route", target_type="route", target_id=route_id)
    return RoutePublic(**doc_id(updated))


@router.post("/buses", response_model=BusPublic)
async def create_bus(
    body: BusCreate,
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> BusPublic:
    customer_id = scope.require_customer_id()
    if body.driver_id:
        driver = await get_db().users.find_one(
            scope.mongo_filter({"_id": as_object_id(body.driver_id, "driver_id"), "role": Role.driver.value})
        )
        if not driver:
            raise HTTPException(status_code=400, detail="Driver not found in this customer")
    if body.route_id:
        route = await get_db().routes.find_one(scope.mongo_filter({"_id": as_object_id(body.route_id, "route_id")}))
        if not route:
            raise HTTPException(status_code=400, detail="Route not found in this customer")
    doc = {
        "bus_number": body.bus_number,
        "driver_id": body.driver_id,
        "route_id": body.route_id,
        "customer_id": customer_id,
        "current_lat": None,
        "current_lng": None,
        "last_updated_at": None,
        "status": "inactive",
        "trip_active": False,
        "next_stop_sequence": 1,
    }
    result = await get_db().buses.insert_one(doc)
    created = await get_db().buses.find_one(scope.mongo_filter({"_id": result.inserted_id}))
    await write_scope_audit(scope, action="create_bus", target_type="bus", target_id=str(result.inserted_id))
    return BusPublic(**enrich_bus(created))


@router.put("/buses/{bus_id}/assign", response_model=BusPublic)
async def assign_bus(
    bus_id: str,
    body: BusAssign,
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> BusPublic:
    bus_oid = as_object_id(bus_id, "bus_id")
    existing = await get_db().buses.find_one(scope.mongo_filter({"_id": bus_oid}))
    if not existing:
        raise HTTPException(status_code=404, detail="Bus not found")
    if body.driver_id:
        driver = await get_db().users.find_one(
            scope.mongo_filter({"_id": as_object_id(body.driver_id, "driver_id"), "role": Role.driver.value})
        )
        if not driver:
            raise HTTPException(status_code=400, detail="Driver not found in this customer")
    if body.route_id:
        route = await get_db().routes.find_one(scope.mongo_filter({"_id": as_object_id(body.route_id, "route_id")}))
        if not route:
            raise HTTPException(status_code=400, detail="Route not found in this customer")
    await get_db().buses.update_one(
        scope.mongo_filter({"_id": bus_oid}),
        {"$set": {"driver_id": body.driver_id, "route_id": body.route_id}},
    )
    updated = await get_db().buses.find_one(scope.mongo_filter({"_id": bus_oid}))
    await write_scope_audit(scope, action="assign_bus", target_type="bus", target_id=bus_id)
    return BusPublic(**enrich_bus(updated))


@router.get("/drivers")
async def list_drivers(
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> list[UserPublic]:
    docs = await get_db().users.find(scope.mongo_filter({"role": Role.driver.value})).to_list(200)
    return [user_from_doc(d) for d in docs]


@router.get("/alerts", response_model=list[AlertLogPublic])
async def list_alerts(
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> list[AlertLogPublic]:
    docs = await get_db().alert_logs.find(scope.mongo_filter()).sort("sent_at", -1).to_list(500)
    return [AlertLogPublic(**doc_id(d)) for d in docs]


@router.get("/audit", response_model=list[AuditLogPublic])
async def list_audit(
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> list[AuditLogPublic]:
    docs = await get_db().audit_logs.find(scope.mongo_filter()).sort("created_at", -1).to_list(300)
    return [AuditLogPublic(**doc_id(d)) for d in docs]


@router.get("/students", response_model=list[StudentPublic])
async def list_students(
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> list[StudentPublic]:
    docs = await get_db().students.find(scope.mongo_filter()).to_list(500)
    return [StudentPublic(**{**doc_id(d), "boarded": bool(d.get("boarded"))}) for d in docs]


@router.post("/students", response_model=StudentPublic)
async def create_student(
    body: StudentCreate,
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> StudentPublic:
    customer_id = scope.require_customer_id()
    parent = await get_db().users.find_one(
        scope.mongo_filter({"_id": as_object_id(body.parent_id, "parent_id"), "role": Role.parent.value})
    )
    if not parent:
        raise HTTPException(status_code=400, detail="Parent not found in this customer")
    route = await get_db().routes.find_one(scope.mongo_filter({"_id": as_object_id(body.route_id, "route_id")}))
    if not route:
        raise HTTPException(status_code=400, detail="Route not found in this customer")
    doc = {**body.model_dump(), "boarded": False, "customer_id": customer_id}
    result = await get_db().students.insert_one(doc)
    created = await get_db().students.find_one(scope.mongo_filter({"_id": result.inserted_id}))
    await write_scope_audit(scope, action="create_student", target_type="student", target_id=str(result.inserted_id))
    return StudentPublic(**{**doc_id(created), "boarded": False})

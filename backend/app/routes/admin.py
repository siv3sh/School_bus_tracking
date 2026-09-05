from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models.schemas import (
    AlertLogPublic,
    BusAssign,
    BusCreate,
    BusPublic,
    Role,
    RouteCreate,
    RoutePublic,
    StopEmbedded,
    StudentCreate,
    StudentPublic,
    UserPublic,
    doc_id,
)
from app.services.auth_service import require_roles
from app.services.location_service import enrich_bus

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/routes", response_model=list[RoutePublic])
async def list_routes(_user: UserPublic = Depends(require_roles(Role.admin))) -> list[RoutePublic]:
    docs = await get_db().routes.find().to_list(200)
    out: list[RoutePublic] = []
    for d in docs:
        payload = doc_id(d)
        payload.setdefault("schedule", "morning")
        out.append(RoutePublic(**payload))
    return out


@router.post("/routes", response_model=RoutePublic)
async def create_route(body: RouteCreate, _user: UserPublic = Depends(require_roles(Role.admin))) -> RoutePublic:
    stops = []
    for i, stop in enumerate(body.stops):
        stop_id = stop.stop_id or str(ObjectId())
        stops.append(StopEmbedded(stop_id=stop_id, name=stop.name, lat=stop.lat, lng=stop.lng, sequence_number=stop.sequence_number or i + 1).model_dump())
    doc = {
        "name": body.name,
        "stops": stops,
        "schedule": body.schedule.value,
        "created_at": datetime.now(timezone.utc),
    }
    result = await get_db().routes.insert_one(doc)
    created = await get_db().routes.find_one({"_id": result.inserted_id})
    return RoutePublic(**doc_id(created))


@router.put("/routes/{route_id}", response_model=RoutePublic)
async def update_route(
    route_id: str,
    body: RouteCreate,
    _user: UserPublic = Depends(require_roles(Role.admin)),
) -> RoutePublic:
    if not ObjectId.is_valid(route_id):
        raise HTTPException(status_code=400, detail="Invalid route id")
    stops = []
    for i, stop in enumerate(body.stops):
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
    await get_db().routes.update_one(
        {"_id": ObjectId(route_id)},
        {
            "$set": {
                "name": body.name,
                "stops": stops,
                "schedule": body.schedule.value,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    updated = await get_db().routes.find_one({"_id": ObjectId(route_id)})
    if not updated:
        raise HTTPException(status_code=404, detail="Route not found")
    return RoutePublic(**doc_id(updated))


@router.post("/buses", response_model=BusPublic)
async def create_bus(body: BusCreate, _user: UserPublic = Depends(require_roles(Role.admin))) -> BusPublic:
    doc = {
        "bus_number": body.bus_number,
        "driver_id": body.driver_id,
        "route_id": body.route_id,
        "current_lat": None,
        "current_lng": None,
        "last_updated_at": None,
        "status": "inactive",
        "trip_active": False,
        "next_stop_sequence": 1,
    }
    result = await get_db().buses.insert_one(doc)
    created = await get_db().buses.find_one({"_id": result.inserted_id})
    return BusPublic(**enrich_bus(created))


@router.put("/buses/{bus_id}/assign", response_model=BusPublic)
async def assign_bus(
    bus_id: str,
    body: BusAssign,
    _user: UserPublic = Depends(require_roles(Role.admin)),
) -> BusPublic:
    if not ObjectId.is_valid(bus_id):
        raise HTTPException(status_code=400, detail="Invalid bus id")
    await get_db().buses.update_one(
        {"_id": ObjectId(bus_id)},
        {"$set": {"driver_id": body.driver_id, "route_id": body.route_id}},
    )
    updated = await get_db().buses.find_one({"_id": ObjectId(bus_id)})
    if not updated:
        raise HTTPException(status_code=404, detail="Bus not found")
    return BusPublic(**enrich_bus(updated))


@router.get("/drivers")
async def list_drivers(_user: UserPublic = Depends(require_roles(Role.admin))) -> list[UserPublic]:
    docs = await get_db().users.find({"role": "driver"}).to_list(200)
    return [UserPublic(**{**doc_id(d), "alert_minutes_before": int(d.get("alert_minutes_before") or 5)}) for d in docs]


@router.get("/alerts", response_model=list[AlertLogPublic])
async def list_alerts(_user: UserPublic = Depends(require_roles(Role.admin))) -> list[AlertLogPublic]:
    docs = await get_db().alert_logs.find().sort("sent_at", -1).to_list(500)
    return [AlertLogPublic(**doc_id(d)) for d in docs]


@router.get("/audit")
async def list_audit(_user: UserPublic = Depends(require_roles(Role.admin))) -> list[dict]:
    docs = await get_db().audit_logs.find().sort("created_at", -1).to_list(300)
    return [doc_id(d) for d in docs]


@router.post("/students", response_model=StudentPublic)
async def create_student(body: StudentCreate, _user: UserPublic = Depends(require_roles(Role.admin))) -> StudentPublic:
    doc = {**body.model_dump(), "boarded": False}
    result = await get_db().students.insert_one(doc)
    created = await get_db().students.find_one({"_id": result.inserted_id})
    return StudentPublic(**{**doc_id(created), "boarded": False})

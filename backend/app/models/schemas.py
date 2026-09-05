from datetime import datetime
from enum import Enum
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Role(str, Enum):
    driver = "driver"
    parent = "parent"
    admin = "admin"


class BusStatus(str, Enum):
    active = "active"
    inactive = "inactive"
    signal_lost = "signal_lost"


class RouteSchedule(str, Enum):
    morning = "morning"
    evening = "evening"
    both = "both"


class MongoModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Role
    phone: Optional[str] = None


class UserPublic(MongoModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    phone: Optional[str] = None
    expo_push_token: Optional[str] = None
    alert_minutes_before: int = 5


class UserInDB(UserPublic):
    password_hash: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class StopEmbedded(BaseModel):
    stop_id: str
    name: str
    lat: float
    lng: float
    sequence_number: int
    reached: bool = False


class RouteCreate(BaseModel):
    name: str
    stops: list[StopEmbedded] = []
    schedule: RouteSchedule = RouteSchedule.morning


class RoutePublic(MongoModel):
    id: str
    name: str
    stops: list[StopEmbedded] = []
    schedule: RouteSchedule = RouteSchedule.morning


class BusCreate(BaseModel):
    bus_number: str
    driver_id: Optional[str] = None
    route_id: Optional[str] = None


class BusAssign(BaseModel):
    driver_id: Optional[str] = None
    route_id: Optional[str] = None


class BusPublic(MongoModel):
    id: str
    bus_number: str
    driver_id: Optional[str] = None
    route_id: Optional[str] = None
    current_lat: Optional[float] = None
    current_lng: Optional[float] = None
    last_updated_at: Optional[datetime] = None
    status: BusStatus = BusStatus.inactive
    is_stale: bool = False
    trip_active: bool = False
    next_stop_sequence: int = 1
    current_trip_id: Optional[str] = None


class StudentCreate(BaseModel):
    name: str
    parent_id: str
    route_id: str
    stop_id: str


class StudentPublic(MongoModel):
    id: str
    name: str
    parent_id: str
    route_id: str
    stop_id: str
    boarded: bool = False


class LocationUpdate(BaseModel):
    bus_id: str
    lat: float
    lng: float
    speed: Optional[float] = None
    recorded_at: datetime


class AlertLogPublic(MongoModel):
    id: str
    bus_id: str
    stop_id: Optional[str] = None
    parent_id: str
    sent_at: datetime
    type: str
    trip_id: Optional[str] = None
    message: Optional[str] = None


class PushTokenUpdate(BaseModel):
    expo_push_token: str


class ParentPrefsUpdate(BaseModel):
    alert_minutes_before: int = Field(ge=5, le=15)


class BroadcastRequest(BaseModel):
    type: str  # delay | emergency
    message: str


class BoardStudentRequest(BaseModel):
    student_id: str
    boarded: bool = True


class BoardedUpdate(BaseModel):
    boarded: bool = True


class AuditLogPublic(MongoModel):
    id: str
    actor_id: str
    actor_role: str
    action: str
    bus_id: Optional[str] = None
    meta: dict = {}
    created_at: datetime


class SchoolContact(BaseModel):
    name: str
    phone: str
    email: str
    address: str


def oid(value: str | ObjectId) -> ObjectId:
    return value if isinstance(value, ObjectId) else ObjectId(value)


def doc_id(doc: dict) -> dict:
    if not doc:
        return doc
    out = {**doc}
    if "_id" in out:
        out["id"] = str(out.pop("_id"))
    return out

from datetime import datetime
from enum import Enum
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Role(str, Enum):
    product_admin = "product_admin"
    customer_admin = "customer_admin"
    driver = "driver"
    parent = "parent"


SCHOOL_OPERATOR_ROLES = (Role.customer_admin, Role.product_admin)
FLEET_ROLES = (Role.driver, Role.customer_admin, Role.product_admin)


class UserStatus(str, Enum):
    invited = "invited"
    active = "active"
    suspended = "suspended"


class CustomerStatus(str, Enum):
    pending = "pending"
    active = "active"
    suspended = "suspended"


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


class UserPublic(MongoModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    phone: Optional[str] = None
    expo_push_token: Optional[str] = None
    alert_minutes_before: int = 5
    customer_id: Optional[str] = None
    status: UserStatus = UserStatus.active


class UserInDB(UserPublic):
    password_hash: str
    invite_token: Optional[str] = None
    invite_expires_at: Optional[datetime] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class WsTicketResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AcceptInviteRequest(BaseModel):
    invite_token: str
    password: str = Field(min_length=8)


class ResendInviteRequest(BaseModel):
    user_id: str


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
    customer_id: Optional[str] = None


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
    customer_id: Optional[str] = None


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
    customer_id: Optional[str] = None


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
    customer_id: Optional[str] = None


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
    customer_id: Optional[str] = None
    actor_user_id: str
    actor_role: str
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    on_behalf_of: Optional[str] = None
    created_at: datetime


class SchoolContact(BaseModel):
    name: str
    phone: str
    email: str
    address: str


class CustomerCreate(BaseModel):
    name: str
    city: str
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    admin_name: str
    admin_email: EmailStr


class CustomerPublic(MongoModel):
    id: str
    name: str
    city: str
    contact_email: EmailStr
    contact_phone: Optional[str] = None
    status: CustomerStatus
    created_at: datetime
    created_by: str


class CustomerStatusUpdate(BaseModel):
    status: CustomerStatus


class SchoolUserCreate(BaseModel):
    name: str
    email: EmailStr
    role: Role
    phone: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8)


class UserStatusUpdate(BaseModel):
    status: UserStatus


class InviteCreatedResponse(BaseModel):
    user: UserPublic
    invite_token: Optional[str] = None
    invite_expires_at: Optional[datetime] = None


class CustomerCreatedResponse(BaseModel):
    customer: CustomerPublic
    admin: UserPublic
    invite_token: str
    invite_expires_at: datetime


def oid(value: str | ObjectId) -> ObjectId:
    return value if isinstance(value, ObjectId) else ObjectId(value)


def doc_id(doc: dict) -> dict:
    if not doc:
        return doc
    out = {**doc}
    if "_id" in out:
        out["id"] = str(out.pop("_id"))
    return out


def user_from_doc(doc: dict) -> UserPublic:
    payload = doc_id(doc)
    payload["alert_minutes_before"] = int(payload.get("alert_minutes_before") or 5)
    payload["customer_id"] = payload.get("customer_id")
    payload["status"] = payload.get("status") or UserStatus.active.value
    payload.pop("password_hash", None)
    payload.pop("invite_token", None)
    payload.pop("invite_expires_at", None)
    return UserPublic(**payload)


def customer_from_doc(doc: dict) -> CustomerPublic:
    return CustomerPublic(**doc_id(doc))

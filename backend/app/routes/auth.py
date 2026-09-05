from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.database import get_db
from app.models.schemas import (
    LoginRequest,
    ParentPrefsUpdate,
    PushTokenUpdate,
    SchoolContact,
    TokenResponse,
    UserPublic,
    doc_id,
)
from app.services.auth_service import (
    create_access_token,
    get_current_user,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    user = await get_db().users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    public = UserPublic(**{**doc_id(user), "alert_minutes_before": int(user.get("alert_minutes_before") or 5)})
    token = create_access_token(user_id=public.id, role=public.role, email=public.email)
    return TokenResponse(access_token=token, user=public)


@router.get("/me", response_model=UserPublic)
async def me(user: UserPublic = Depends(get_current_user)) -> UserPublic:
    raw = await get_db().users.find_one({"_id": ObjectId(user.id)})
    return UserPublic(**{**doc_id(raw), "alert_minutes_before": int((raw or {}).get("alert_minutes_before") or 5)})


@router.post("/push-token", response_model=UserPublic)
async def update_push_token(
    body: PushTokenUpdate,
    user: UserPublic = Depends(get_current_user),
) -> UserPublic:
    await get_db().users.update_one(
        {"_id": ObjectId(user.id)},
        {"$set": {"expo_push_token": body.expo_push_token, "updated_at": datetime.now(timezone.utc)}},
    )
    updated = await get_db().users.find_one({"_id": ObjectId(user.id)})
    return UserPublic(**{**doc_id(updated), "alert_minutes_before": int(updated.get("alert_minutes_before") or 5)})


@router.put("/prefs", response_model=UserPublic)
async def update_prefs(body: ParentPrefsUpdate, user: UserPublic = Depends(get_current_user)) -> UserPublic:
    # Only 5, 10, or 15
    minutes = body.alert_minutes_before
    if minutes not in (5, 10, 15):
        raise HTTPException(status_code=400, detail="alert_minutes_before must be 5, 10, or 15")
    await get_db().users.update_one(
        {"_id": ObjectId(user.id)},
        {"$set": {"alert_minutes_before": minutes}},
    )
    updated = await get_db().users.find_one({"_id": ObjectId(user.id)})
    return UserPublic(**{**doc_id(updated), "alert_minutes_before": minutes})


@router.get("/school-contact", response_model=SchoolContact)
async def school_contact(_user: UserPublic = Depends(get_current_user)) -> SchoolContact:
    return SchoolContact(
        name=settings.school_name,
        phone=settings.school_phone,
        email=settings.school_email,
        address=settings.school_address,
    )

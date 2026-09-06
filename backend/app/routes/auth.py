from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.database import get_db
from app.models.schemas import (
    AcceptInviteRequest,
    CustomerStatus,
    LoginRequest,
    ParentPrefsUpdate,
    PushTokenUpdate,
    ResendInviteRequest,
    Role,
    SchoolContact,
    TokenResponse,
    UserPublic,
    UserStatus,
    WsTicketResponse,
    user_from_doc,
)
from app.services.audit_service import write_audit, write_scope_audit
from app.services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    reject_if_unusable,
    require_roles,
    verify_password,
)
from app.services.invite_service import as_object_id, refresh_invite_fields
from app.services.tenant import TenantScope, get_tenant_scope

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    user = await get_db().users.find_one({"email": body.email.lower()})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    public = user_from_doc(user)
    if public.status is UserStatus.invited or public.status is UserStatus.suspended:
        await reject_if_unusable(public)
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    await reject_if_unusable(public)
    token = create_access_token(
        user_id=public.id,
        role=public.role,
        email=public.email,
        customer_id=public.customer_id,
        user_status=public.status,
    )
    return TokenResponse(access_token=token, user=public)


@router.post("/ws-ticket", response_model=WsTicketResponse)
async def ws_ticket(user: UserPublic = Depends(get_current_user)) -> WsTicketResponse:
    minutes = settings.jwt_ws_expire_minutes
    token = create_access_token(
        user_id=user.id,
        role=user.role,
        email=user.email,
        customer_id=user.customer_id,
        user_status=user.status,
        expires_minutes=minutes,
    )
    return WsTicketResponse(access_token=token, expires_in=minutes * 60)


@router.get("/me", response_model=UserPublic)
async def me(user: UserPublic = Depends(get_current_user)) -> UserPublic:
    raw = await get_db().users.find_one({"_id": ObjectId(user.id)})
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user_from_doc(raw)


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
    return user_from_doc(updated)


@router.put("/prefs", response_model=UserPublic)
async def update_prefs(body: ParentPrefsUpdate, user: UserPublic = Depends(get_current_user)) -> UserPublic:
    minutes = body.alert_minutes_before
    if minutes not in (5, 10, 15):
        raise HTTPException(status_code=400, detail="alert_minutes_before must be 5, 10, or 15")
    await get_db().users.update_one(
        {"_id": ObjectId(user.id)},
        {"$set": {"alert_minutes_before": minutes}},
    )
    updated = await get_db().users.find_one({"_id": ObjectId(user.id)})
    return user_from_doc(updated)


@router.get("/school-contact", response_model=SchoolContact)
async def school_contact(scope: TenantScope = Depends(get_tenant_scope)) -> SchoolContact:
    if scope.customer_id and ObjectId.is_valid(scope.customer_id):
        customer = await get_db().customers.find_one({"_id": ObjectId(scope.customer_id)})
        if customer:
            return SchoolContact(
                name=customer.get("name") or settings.school_name,
                phone=customer.get("contact_phone") or settings.school_phone,
                email=customer.get("contact_email") or settings.school_email,
                address=customer.get("city") or settings.school_address,
            )
    return SchoolContact(
        name=settings.school_name,
        phone=settings.school_phone,
        email=settings.school_email,
        address=settings.school_address,
    )


@router.post("/accept-invite", response_model=TokenResponse)
async def accept_invite(body: AcceptInviteRequest) -> TokenResponse:
    db = get_db()
    user = await db.users.find_one({"invite_token": body.invite_token, "status": UserStatus.invited.value})
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invite token")
    expires = user.get("invite_expires_at")
    if expires is not None:
        exp = expires if expires.tzinfo else expires.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite has expired")

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": hash_password(body.password),
                "status": UserStatus.active.value,
                "invite_token": None,
                "invite_expires_at": None,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    updated = await db.users.find_one({"_id": user["_id"]})
    public = user_from_doc(updated)

    customer_id = public.customer_id
    if public.role is Role.customer_admin and customer_id and ObjectId.is_valid(customer_id):
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
        if customer and customer.get("status") == CustomerStatus.pending.value:
            await db.customers.update_one(
                {"_id": ObjectId(customer_id)},
                {"$set": {"status": CustomerStatus.active.value, "updated_at": datetime.now(timezone.utc)}},
            )

    await write_audit(
        actor_user_id=public.id,
        actor_role=public.role.value,
        action="accept_invite",
        customer_id=customer_id,
        target_type="user",
        target_id=public.id,
    )
    token = create_access_token(
        user_id=public.id,
        role=public.role,
        email=public.email,
        customer_id=public.customer_id,
        user_status=public.status,
    )
    return TokenResponse(access_token=token, user=public)


@router.post("/resend-invite")
async def resend_invite(
    body: ResendInviteRequest,
    _user: UserPublic = Depends(require_roles(Role.product_admin, Role.customer_admin)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> dict:
    user_oid = as_object_id(body.user_id, "user_id")
    target = await get_db().users.find_one(scope.mongo_filter({"_id": user_oid}))
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.get("status") != UserStatus.invited.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not in invited status")

    token, expires = refresh_invite_fields()
    await get_db().users.update_one(
        scope.mongo_filter({"_id": user_oid}),
        {"$set": {"invite_token": token, "invite_expires_at": expires, "updated_at": datetime.now(timezone.utc)}},
    )
    await write_scope_audit(
        scope,
        action="resend_invite",
        target_type="user",
        target_id=str(user_oid),
        customer_id=target.get("customer_id"),
    )
    return {"ok": True, "invite_token": token, "invite_expires_at": expires}

from datetime import datetime, timezone
from typing import assert_never

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.models.schemas import (
    InviteCreatedResponse,
    Role,
    SCHOOL_OPERATOR_ROLES,
    SchoolUserCreate,
    UserPublic,
    UserStatus,
    UserStatusUpdate,
    user_from_doc,
)
from app.services.audit_service import write_scope_audit
from app.services.auth_service import require_roles
from app.services.invite_service import as_object_id, insert_invited_user
from app.services.tenant import TenantScope, get_tenant_scope

router = APIRouter(prefix="/api/school", tags=["school"])


@router.get("/users", response_model=list[UserPublic])
async def list_school_users(
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> list[UserPublic]:
    scope.require_customer_id()
    docs = await get_db().users.find(scope.mongo_filter({"role": {"$in": ["driver", "parent", "customer_admin"]}})).to_list(500)
    return [user_from_doc(d) for d in docs]


@router.post("/users", response_model=InviteCreatedResponse)
async def create_school_user(
    body: SchoolUserCreate,
    _user: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> InviteCreatedResponse:
    customer_id = scope.require_customer_id()
    if body.role not in (Role.driver, Role.parent):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="School users may only be created as driver or parent",
        )
    created, token, expires = await insert_invited_user(
        name=body.name,
        email=str(body.email),
        role=body.role,
        phone=body.phone,
        customer_id=customer_id,
        password=body.password,
    )
    await write_scope_audit(
        scope,
        action="invite_user",
        target_type="user",
        target_id=str(created["_id"]),
        customer_id=customer_id,
    )
    return InviteCreatedResponse(user=user_from_doc(created), invite_token=token, invite_expires_at=expires)


@router.patch("/users/{user_id}/status", response_model=UserPublic)
async def update_school_user_status(
    user_id: str,
    body: UserStatusUpdate,
    actor: UserPublic = Depends(require_roles(*SCHOOL_OPERATOR_ROLES)),
    scope: TenantScope = Depends(get_tenant_scope),
) -> UserPublic:
    scope.require_customer_id()
    if body.status is UserStatus.invited:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot set user status to invited")
    if body.status is UserStatus.suspended:
        action = "suspend_user"
    elif body.status is UserStatus.active:
        action = "unsuspend_user"
    else:
        assert_never(body.status)
    user_oid = as_object_id(user_id, "user_id")
    if str(user_oid) == actor.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own status")
    target = await get_db().users.find_one(scope.mongo_filter({"_id": user_oid}))
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    target_role = target.get("role")
    if actor.role is Role.customer_admin and target_role not in (Role.driver.value, Role.parent.value):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot change this user's status")
    await get_db().users.update_one(
        scope.mongo_filter({"_id": user_oid}),
        {"$set": {"status": body.status.value, "updated_at": datetime.now(timezone.utc)}},
    )
    updated = await get_db().users.find_one(scope.mongo_filter({"_id": user_oid}))
    await write_scope_audit(scope, action=action, target_type="user", target_id=user_id)
    return user_from_doc(updated)

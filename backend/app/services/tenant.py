from typing import Optional, assert_never

from bson import ObjectId
from fastapi import Depends, Header, HTTPException, Query, status

from app.database import get_db
from app.models.schemas import Role, UserPublic, user_from_doc
from app.services.auth_service import get_current_user, reject_if_unusable


def school_filter(customer_id: str | None, extra: dict | None = None) -> dict:
    """Build a Mongo filter. Callers must go through TenantScope.mongo_filter for request paths."""
    query = dict(extra or {})
    if customer_id is not None:
        query["customer_id"] = customer_id
    return query


class TenantScope:
    """Resolved tenant for the current request. School-scoped queries MUST use mongo_filter()."""

    def __init__(
        self,
        *,
        customer_id: str | None,
        actor: UserPublic,
        on_behalf_of: str | None,
    ) -> None:
        self.customer_id = customer_id
        self.actor = actor
        self.on_behalf_of = on_behalf_of

    def mongo_filter(self, extra: dict | None = None) -> dict:
        return school_filter(self.customer_id, extra)

    def require_customer_id(self) -> str:
        if not self.customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="customer_id query param or X-Customer-Id header is required",
            )
        return self.customer_id


def tenant_scope_for_user(user: UserPublic, acting_customer_id: str | None = None) -> TenantScope:
    if user.role is Role.product_admin:
        return TenantScope(
            customer_id=acting_customer_id,
            actor=user,
            on_behalf_of=acting_customer_id,
        )
    if user.role is Role.customer_admin or user.role is Role.driver or user.role is Role.parent:
        if not user.customer_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not bound to a customer",
            )
        return TenantScope(customer_id=user.customer_id, actor=user, on_behalf_of=None)
    assert_never(user.role)


async def get_tenant_scope(
    user: UserPublic = Depends(get_current_user),
    customer_id: Optional[str] = Query(default=None),
    x_customer_id: Optional[str] = Header(default=None, alias="X-Customer-Id"),
) -> TenantScope:
    acting = x_customer_id or customer_id
    if x_customer_id and customer_id and x_customer_id != customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Customer-Id header and customer_id query param do not match",
        )
    if user.role is not Role.product_admin:
        return tenant_scope_for_user(user)

    if not acting:
        return tenant_scope_for_user(user)

    if not ObjectId.is_valid(acting):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid customer_id")
    customer = await get_db().customers.find_one({"_id": ObjectId(acting)})
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return tenant_scope_for_user(user, acting_customer_id=acting)


async def tenant_scope_from_token_payload(
    payload: dict,
    acting_customer_id: str | None = None,
) -> TenantScope:
    user_id = payload.get("sub")
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    user = await get_db().users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    public = user_from_doc(user)
    await reject_if_unusable(public)
    if public.role is Role.product_admin and acting_customer_id:
        if not ObjectId.is_valid(acting_customer_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid customer_id")
        customer = await get_db().customers.find_one({"_id": ObjectId(acting_customer_id)})
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        return tenant_scope_for_user(public, acting_customer_id=acting_customer_id)
    return tenant_scope_for_user(public)
    user_id = payload.get("sub")
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    user = await get_db().users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    public = user_from_doc(user)
    await reject_if_unusable(public)
    return tenant_scope_for_user(public)

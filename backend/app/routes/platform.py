from datetime import datetime, timezone
from typing import assert_never

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.models.schemas import (
    CustomerCreate,
    CustomerCreatedResponse,
    CustomerPublic,
    CustomerStatus,
    CustomerStatusUpdate,
    Role,
    UserPublic,
    customer_from_doc,
    user_from_doc,
)
from app.services.audit_service import write_audit
from app.services.auth_service import require_roles
from app.services.invite_service import as_object_id, ensure_email_free, insert_invited_user

router = APIRouter(prefix="/api/platform", tags=["platform"])


@router.get("/customers", response_model=list[CustomerPublic])
async def list_customers(_user: UserPublic = Depends(require_roles(Role.product_admin))) -> list[CustomerPublic]:
    docs = await get_db().customers.find().sort("created_at", -1).to_list(500)
    return [customer_from_doc(d) for d in docs]


@router.post("/customers", response_model=CustomerCreatedResponse)
async def create_customer(
    body: CustomerCreate,
    user: UserPublic = Depends(require_roles(Role.product_admin)),
) -> CustomerCreatedResponse:
    db = get_db()
    await ensure_email_free(str(body.admin_email))
    now = datetime.now(timezone.utc)
    customer_oid = ObjectId()
    customer_doc = {
        "_id": customer_oid,
        "name": body.name,
        "city": body.city,
        "contact_email": str(body.contact_email).lower(),
        "contact_phone": body.contact_phone,
        "status": CustomerStatus.pending.value,
        "created_at": now,
        "created_by": user.id,
    }
    await db.customers.insert_one(customer_doc)
    customer_id = str(customer_oid)

    admin_doc, token, expires = await insert_invited_user(
        name=body.admin_name,
        email=str(body.admin_email),
        role=Role.customer_admin,
        phone=body.contact_phone,
        customer_id=customer_id,
    )
    await write_audit(
        actor_user_id=user.id,
        actor_role=user.role.value,
        action="create_customer",
        customer_id=customer_id,
        target_type="customer",
        target_id=customer_id,
    )
    await write_audit(
        actor_user_id=user.id,
        actor_role=user.role.value,
        action="invite_user",
        customer_id=customer_id,
        target_type="user",
        target_id=str(admin_doc["_id"]),
    )
    return CustomerCreatedResponse(
        customer=customer_from_doc(customer_doc),
        admin=user_from_doc(admin_doc),
        invite_token=token,
        invite_expires_at=expires,
    )


@router.get("/customers/{customer_id}", response_model=CustomerPublic)
async def get_customer(
    customer_id: str,
    _user: UserPublic = Depends(require_roles(Role.product_admin)),
) -> CustomerPublic:
    oid = as_object_id(customer_id, "customer_id")
    doc = await get_db().customers.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer_from_doc(doc)


@router.patch("/customers/{customer_id}/status", response_model=CustomerPublic)
async def update_customer_status(
    customer_id: str,
    body: CustomerStatusUpdate,
    user: UserPublic = Depends(require_roles(Role.product_admin)),
) -> CustomerPublic:
    if body.status is CustomerStatus.pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot set customer status to pending")
    if body.status is CustomerStatus.suspended:
        action = "suspend_customer"
    elif body.status is CustomerStatus.active:
        action = "unsuspend_customer"
    else:
        assert_never(body.status)
    oid = as_object_id(customer_id, "customer_id")
    existing = await get_db().customers.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    await get_db().customers.update_one(
        {"_id": oid},
        {"$set": {"status": body.status.value, "updated_at": datetime.now(timezone.utc)}},
    )
    updated = await get_db().customers.find_one({"_id": oid})
    await write_audit(
        actor_user_id=user.id,
        actor_role=user.role.value,
        action=action,
        customer_id=customer_id,
        target_type="customer",
        target_id=customer_id,
    )
    return customer_from_doc(updated)

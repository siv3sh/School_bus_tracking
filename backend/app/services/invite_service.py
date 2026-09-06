from datetime import datetime, timedelta, timezone
import secrets

from bson import ObjectId
from fastapi import HTTPException, status

from app.database import get_db
from app.models.schemas import Role, UserStatus
from app.services.auth_service import hash_password

INVITE_TTL = timedelta(hours=48)


def issue_invite() -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + INVITE_TTL
    return token, expires


async def ensure_email_free(email: str) -> None:
    existing = await get_db().users.find_one({"email": email.lower()})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")


async def insert_invited_user(
    *,
    name: str,
    email: str,
    role: Role,
    phone: str | None,
    customer_id: str,
    password: str | None = None,
) -> tuple[dict, str | None, datetime | None]:
    await ensure_email_free(email)
    if password:
        token, expires = None, None
        user_status = UserStatus.active.value
        password_hash = hash_password(password)
    else:
        token, expires = issue_invite()
        user_status = UserStatus.invited.value
        password_hash = hash_password(secrets.token_urlsafe(24))
    doc = {
        "name": name,
        "email": email.lower(),
        "password_hash": password_hash,
        "role": role.value,
        "phone": phone,
        "expo_push_token": None,
        "alert_minutes_before": 5,
        "customer_id": customer_id,
        "status": user_status,
        "invite_token": token,
        "invite_expires_at": expires,
        "created_at": datetime.now(timezone.utc),
    }
    result = await get_db().users.insert_one(doc)
    created = await get_db().users.find_one({"_id": result.inserted_id})
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user")
    return created, token, expires


def refresh_invite_fields() -> tuple[str, datetime]:
    return issue_invite()


def as_object_id(value: str, label: str = "id") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {label}")
    return ObjectId(value)

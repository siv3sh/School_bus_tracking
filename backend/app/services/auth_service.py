from datetime import datetime, timedelta, timezone
from typing import Any, Optional, assert_never

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings
from app.database import get_db
from app.models.schemas import (
    CustomerStatus,
    Role,
    UserPublic,
    UserStatus,
    user_from_doc,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(
    *,
    user_id: str,
    role: Role,
    email: str,
    customer_id: str | None,
    user_status: UserStatus,
    expires_minutes: int | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes if expires_minutes is not None else settings.jwt_expire_minutes
    )
    payload = {
        "sub": user_id,
        "role": role.value,
        "email": email,
        "customer_id": customer_id,
        "status": user_status.value,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


async def reject_if_unusable(user: UserPublic) -> None:
    if user.status is UserStatus.invited:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invite must be accepted before signing in",
        )
    if user.status is UserStatus.suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is suspended")
    if user.status is UserStatus.active:
        pass
    else:
        assert_never(user.status)

    if user.role is Role.product_admin:
        return
    if not user.customer_id or not ObjectId.is_valid(user.customer_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not bound to a customer")
    customer = await get_db().customers.find_one({"_id": ObjectId(user.customer_id)})
    if not customer:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer not found")
    customer_status = customer.get("status")
    if customer_status == CustomerStatus.suspended.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Customer account is suspended")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> UserPublic:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id or not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")
    user = await get_db().users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    public = user_from_doc(user)
    await reject_if_unusable(public)
    return public


def require_roles(*roles: Role):
    async def _checker(user: UserPublic = Depends(get_current_user)) -> UserPublic:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user

    return _checker

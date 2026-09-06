from datetime import datetime, timezone
from typing import Optional

from app.database import get_db


async def write_audit(
    *,
    actor_user_id: str,
    actor_role: str,
    action: str,
    customer_id: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    on_behalf_of: Optional[str] = None,
) -> None:
    await get_db().audit_logs.insert_one(
        {
            "customer_id": customer_id,
            "actor_user_id": actor_user_id,
            "actor_role": actor_role,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "on_behalf_of": on_behalf_of,
            "created_at": datetime.now(timezone.utc),
        }
    )


async def write_scope_audit(
    scope,
    *,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    customer_id: Optional[str] = None,
) -> None:
    await write_audit(
        actor_user_id=scope.actor.id,
        actor_role=scope.actor.role.value,
        action=action,
        customer_id=customer_id if customer_id is not None else scope.customer_id,
        target_type=target_type,
        target_id=target_id,
        on_behalf_of=scope.on_behalf_of,
    )

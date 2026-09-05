from datetime import datetime, timezone
from typing import Any, Optional

from app.database import get_db


async def write_audit(
    *,
    actor_id: str,
    actor_role: str,
    action: str,
    bus_id: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
) -> None:
    await get_db().audit_logs.insert_one(
        {
            "actor_id": actor_id,
            "actor_role": actor_role,
            "action": action,
            "bus_id": bus_id,
            "meta": meta or {},
            "created_at": datetime.now(timezone.utc),
        }
    )

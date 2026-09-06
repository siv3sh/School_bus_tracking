"""Idempotent tenancy migration for existing single-school databases.

Does not delete buses/routes/students/alerts. Converts role=admin to customer_admin
and stamps customer_id on school-owned collections.

  PYTHONPATH=. python migrate_tenancy.py
"""

import asyncio
from datetime import datetime, timezone

from bson import ObjectId

from app.database import close_db, get_db
from app.services.auth_service import hash_password

LEGACY_CUSTOMER_NAME = "Migrated School"
PRODUCT_ADMIN_EMAIL = "owner@platform.app"


async def migrate() -> None:
    db = get_db()
    now = datetime.now(timezone.utc)

    owner = await db.users.find_one({"role": "product_admin"})
    if not owner:
        owner_id = ObjectId()
        await db.users.insert_one(
            {
                "_id": owner_id,
                "name": "Platform Owner",
                "email": PRODUCT_ADMIN_EMAIL,
                "password_hash": hash_password("password123"),
                "role": "product_admin",
                "phone": None,
                "expo_push_token": None,
                "alert_minutes_before": 5,
                "customer_id": None,
                "status": "active",
                "invite_token": None,
                "invite_expires_at": None,
                "created_at": now,
            }
        )
        print(f"Created product_admin {PRODUCT_ADMIN_EMAIL} / password123")
        owner = await db.users.find_one({"_id": owner_id})
    owner_id = str(owner["_id"])

    customer = await db.customers.find_one({})
    if not customer:
        customer_oid = ObjectId()
        await db.customers.insert_one(
            {
                "_id": customer_oid,
                "name": LEGACY_CUSTOMER_NAME,
                "city": "",
                "contact_email": "office@schoolbus.app",
                "contact_phone": None,
                "status": "active",
                "created_at": now,
                "created_by": owner_id,
            }
        )
        customer = await db.customers.find_one({"_id": customer_oid})
        print(f"Created customer {LEGACY_CUSTOMER_NAME} id={customer_oid}")
    customer_id = str(customer["_id"])

    admin_result = await db.users.update_many(
        {"role": "admin"},
        {"$set": {"role": "customer_admin", "customer_id": customer_id, "status": "active"}},
    )
    print(f"Converted admin -> customer_admin: {admin_result.modified_count}")

    unbound = await db.users.update_many(
        {"role": {"$in": ["customer_admin", "driver", "parent"]}, "customer_id": {"$in": [None, ""]}},
        {"$set": {"customer_id": customer_id}},
    )
    print(f"Bound school users to customer: {unbound.modified_count}")

    status_result = await db.users.update_many(
        {"status": {"$exists": False}},
        {"$set": {"status": "active", "invite_token": None, "invite_expires_at": None}},
    )
    print(f"Set missing user.status=active: {status_result.modified_count}")

    for collection in ("buses", "routes", "students", "alert_logs"):
        result = await db[collection].update_many(
            {"customer_id": {"$exists": False}},
            {"$set": {"customer_id": customer_id}},
        )
        result2 = await db[collection].update_many(
            {"customer_id": None},
            {"$set": {"customer_id": customer_id}},
        )
        print(f"Stamped {collection}.customer_id: {result.modified_count + result2.modified_count}")

    await close_db()
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())

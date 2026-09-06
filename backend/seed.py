"""Seed Phase 1 demo data: 1 route (4 stops), 1 driver, 1 bus, 2 parents + children."""

import asyncio
from datetime import datetime, timezone

from bson import ObjectId

from app.database import close_db, get_db
from app.services.auth_service import hash_password

# Demo coordinates around a small school corridor (Bangalore-ish sample)
STOPS = [
    {"name": "Oak Street", "lat": 12.9716, "lng": 77.5946, "sequence_number": 1},
    {"name": "Maple Avenue", "lat": 12.9750, "lng": 77.5990, "sequence_number": 2},
    {"name": "Cedar Lane", "lat": 12.9790, "lng": 77.6035, "sequence_number": 3},
    {"name": "School Gate", "lat": 12.9835, "lng": 77.6080, "sequence_number": 4},
]


async def seed(*, disconnect: bool = True) -> None:
    db = get_db()
    await db.users.delete_many({})
    await db.routes.delete_many({})
    await db.buses.delete_many({})
    await db.students.delete_many({})
    await db.alert_logs.delete_many({})
    await db.audit_logs.delete_many({})

    driver_id = ObjectId()
    parent1_id = ObjectId()
    parent2_id = ObjectId()
    admin_id = ObjectId()
    route_id = ObjectId()
    bus_id = ObjectId()

    stop_docs = []
    for s in STOPS:
        stop_docs.append(
            {
                "stop_id": str(ObjectId()),
                "name": s["name"],
                "lat": s["lat"],
                "lng": s["lng"],
                "sequence_number": s["sequence_number"],
                "reached": False,
            }
        )

    await db.users.insert_many(
        [
            {
                "_id": admin_id,
                "name": "Admin User",
                "email": "admin@schoolbus.app",
                "password_hash": hash_password("password123"),
                "role": "admin",
                "phone": "9000000001",
                "expo_push_token": None,
                "alert_minutes_before": 5,
            },
            {
                "_id": driver_id,
                "name": "Demo Driver",
                "email": "driver@schoolbus.app",
                "password_hash": hash_password("password123"),
                "role": "driver",
                "phone": "9000000002",
                "expo_push_token": None,
                "alert_minutes_before": 5,
            },
            {
                "_id": parent1_id,
                "name": "Parent One",
                "email": "parent1@schoolbus.app",
                "password_hash": hash_password("password123"),
                "role": "parent",
                "phone": "9000000003",
                "expo_push_token": None,
                "alert_minutes_before": 5,
            },
            {
                "_id": parent2_id,
                "name": "Parent Two",
                "email": "parent2@schoolbus.app",
                "password_hash": hash_password("password123"),
                "role": "parent",
                "phone": "9000000004",
                "expo_push_token": None,
                "alert_minutes_before": 10,
            },
        ]
    )

    await db.routes.insert_one(
        {"_id": route_id, "name": "Morning Route A", "schedule": "morning", "stops": stop_docs}
    )

    await db.buses.insert_one(
        {
            "_id": bus_id,
            "bus_number": "BUS-101",
            "driver_id": str(driver_id),
            "route_id": str(route_id),
            "current_lat": STOPS[0]["lat"],
            "current_lng": STOPS[0]["lng"],
            "last_updated_at": datetime.now(timezone.utc),
            "status": "inactive",
            "trip_active": False,
            "next_stop_sequence": 1,
            "current_trip_id": None,
        }
    )

    await db.students.insert_many(
        [
            {
                "name": "Aanya",
                "parent_id": str(parent1_id),
                "route_id": str(route_id),
                "stop_id": stop_docs[1]["stop_id"],
                "boarded": False,
            },
            {
                "name": "Rohan",
                "parent_id": str(parent2_id),
                "route_id": str(route_id),
                "stop_id": stop_docs[2]["stop_id"],
                "boarded": False,
            },
        ]
    )

    print("Seed complete.")
    print("  admin@schoolbus.app / password123")
    print("  driver@schoolbus.app / password123")
    print("  parent1@schoolbus.app / password123")
    print("  parent2@schoolbus.app / password123")
    print(f"  bus_id={bus_id} route_id={route_id}")
    if disconnect:
        await close_db()


if __name__ == "__main__":
    asyncio.run(seed())

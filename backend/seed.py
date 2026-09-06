"""Seed multi-tenant demo data: 1 product admin + 2 isolated customers (schools)."""

import asyncio
from datetime import datetime, timezone

from bson import ObjectId

from app.database import close_db, get_db
from app.services.auth_service import hash_password

PASSWORD = "password123"

STOPS_A = [
    {"name": "Oak Street", "lat": 12.9716, "lng": 77.5946, "sequence_number": 1},
    {"name": "Maple Avenue", "lat": 12.9750, "lng": 77.5990, "sequence_number": 2},
    {"name": "Cedar Lane", "lat": 12.9790, "lng": 77.6035, "sequence_number": 3},
    {"name": "School Gate", "lat": 12.9835, "lng": 77.6080, "sequence_number": 4},
]

STOPS_B = [
    {"name": "Park View", "lat": 13.0827, "lng": 80.2707, "sequence_number": 1},
    {"name": "Lake Road", "lat": 13.0860, "lng": 80.2750, "sequence_number": 2},
    {"name": "Hill Street", "lat": 13.0900, "lng": 80.2790, "sequence_number": 3},
    {"name": "School Gate", "lat": 13.0940, "lng": 80.2830, "sequence_number": 4},
]


def _user(
    *,
    user_id: ObjectId,
    name: str,
    email: str,
    role: str,
    phone: str,
    customer_id: str | None,
    alert_minutes_before: int = 5,
) -> dict:
    return {
        "_id": user_id,
        "name": name,
        "email": email,
        "password_hash": hash_password(PASSWORD),
        "role": role,
        "phone": phone,
        "expo_push_token": None,
        "alert_minutes_before": alert_minutes_before,
        "customer_id": customer_id,
        "status": "active",
        "invite_token": None,
        "invite_expires_at": None,
        "created_at": datetime.now(timezone.utc),
    }


def _stops(rows: list[dict]) -> list[dict]:
    return [
        {
            "stop_id": str(ObjectId()),
            "name": row["name"],
            "lat": row["lat"],
            "lng": row["lng"],
            "sequence_number": row["sequence_number"],
            "reached": False,
        }
        for row in rows
    ]


async def seed() -> None:
    db = get_db()
    await db.users.delete_many({})
    await db.customers.delete_many({})
    await db.routes.delete_many({})
    await db.buses.delete_many({})
    await db.students.delete_many({})
    await db.alert_logs.delete_many({})
    await db.audit_logs.delete_many({})

    owner_id = ObjectId()
    customer_a_id = ObjectId()
    customer_b_id = ObjectId()
    admin_a_id = ObjectId()
    admin_b_id = ObjectId()
    driver_a_id = ObjectId()
    driver_b_id = ObjectId()
    parent1_a_id = ObjectId()
    parent2_a_id = ObjectId()
    parent_b_id = ObjectId()
    route_a_id = ObjectId()
    route_b_id = ObjectId()
    bus_a_id = ObjectId()
    bus_b_id = ObjectId()
    now = datetime.now(timezone.utc)

    await db.customers.insert_many(
        [
            {
                "_id": customer_a_id,
                "name": "Maple Public School",
                "city": "Bengaluru",
                "contact_email": "office@maple.school",
                "contact_phone": "+91 90000 00000",
                "status": "active",
                "created_at": now,
                "created_by": str(owner_id),
            },
            {
                "_id": customer_b_id,
                "name": "Cedar International",
                "city": "Chennai",
                "contact_email": "office@cedar.school",
                "contact_phone": "+91 90000 00010",
                "status": "active",
                "created_at": now,
                "created_by": str(owner_id),
            },
        ]
    )

    cid_a = str(customer_a_id)
    cid_b = str(customer_b_id)

    await db.users.insert_many(
        [
            _user(
                user_id=owner_id,
                name="Platform Owner",
                email="owner@platform.app",
                role="product_admin",
                phone="9000000000",
                customer_id=None,
            ),
            _user(
                user_id=admin_a_id,
                name="Maple Admin",
                email="admin@schoolbus.app",
                role="customer_admin",
                phone="9000000001",
                customer_id=cid_a,
            ),
            _user(
                user_id=driver_a_id,
                name="Demo Driver",
                email="driver@schoolbus.app",
                role="driver",
                phone="9000000002",
                customer_id=cid_a,
            ),
            _user(
                user_id=parent1_a_id,
                name="Parent One",
                email="parent1@schoolbus.app",
                role="parent",
                phone="9000000003",
                customer_id=cid_a,
            ),
            _user(
                user_id=parent2_a_id,
                name="Parent Two",
                email="parent2@schoolbus.app",
                role="parent",
                phone="9000000004",
                customer_id=cid_a,
                alert_minutes_before=10,
            ),
            _user(
                user_id=admin_b_id,
                name="Cedar Admin",
                email="admin.b@schoolbus.app",
                role="customer_admin",
                phone="9000000011",
                customer_id=cid_b,
            ),
            _user(
                user_id=driver_b_id,
                name="Cedar Driver",
                email="driver.b@schoolbus.app",
                role="driver",
                phone="9000000012",
                customer_id=cid_b,
            ),
            _user(
                user_id=parent_b_id,
                name="Cedar Parent",
                email="parent.b@schoolbus.app",
                role="parent",
                phone="9000000013",
                customer_id=cid_b,
            ),
        ]
    )

    stops_a = _stops(STOPS_A)
    stops_b = _stops(STOPS_B)

    await db.routes.insert_many(
        [
            {
                "_id": route_a_id,
                "name": "Morning Route A",
                "schedule": "morning",
                "stops": stops_a,
                "customer_id": cid_a,
            },
            {
                "_id": route_b_id,
                "name": "Morning Route B",
                "schedule": "morning",
                "stops": stops_b,
                "customer_id": cid_b,
            },
        ]
    )

    await db.buses.insert_many(
        [
            {
                "_id": bus_a_id,
                "bus_number": "BUS-101",
                "driver_id": str(driver_a_id),
                "route_id": str(route_a_id),
                "customer_id": cid_a,
                "current_lat": STOPS_A[0]["lat"],
                "current_lng": STOPS_A[0]["lng"],
                "last_updated_at": now,
                "status": "inactive",
                "trip_active": False,
                "next_stop_sequence": 1,
                "current_trip_id": None,
            },
            {
                "_id": bus_b_id,
                "bus_number": "BUS-202",
                "driver_id": str(driver_b_id),
                "route_id": str(route_b_id),
                "customer_id": cid_b,
                "current_lat": STOPS_B[0]["lat"],
                "current_lng": STOPS_B[0]["lng"],
                "last_updated_at": now,
                "status": "inactive",
                "trip_active": False,
                "next_stop_sequence": 1,
                "current_trip_id": None,
            },
        ]
    )

    await db.students.insert_many(
        [
            {
                "name": "Aanya",
                "parent_id": str(parent1_a_id),
                "route_id": str(route_a_id),
                "stop_id": stops_a[1]["stop_id"],
                "boarded": False,
                "customer_id": cid_a,
            },
            {
                "name": "Rohan",
                "parent_id": str(parent2_a_id),
                "route_id": str(route_a_id),
                "stop_id": stops_a[2]["stop_id"],
                "boarded": False,
                "customer_id": cid_a,
            },
            {
                "name": "Meera",
                "parent_id": str(parent_b_id),
                "route_id": str(route_b_id),
                "stop_id": stops_b[1]["stop_id"],
                "boarded": False,
                "customer_id": cid_b,
            },
        ]
    )

    print("Seed complete. Password for all accounts:", PASSWORD)
    print("  product_admin     owner@platform.app")
    print("  --- Maple Public School (customer A) ---")
    print("  customer_admin    admin@schoolbus.app")
    print("  driver            driver@schoolbus.app")
    print("  parent            parent1@schoolbus.app  (Aanya)")
    print("  parent            parent2@schoolbus.app  (Rohan)")
    print(f"  bus_id={bus_a_id} route_id={route_a_id} customer_id={cid_a}")
    print("  --- Cedar International (customer B) ---")
    print("  customer_admin    admin.b@schoolbus.app")
    print("  driver            driver.b@schoolbus.app")
    print("  parent            parent.b@schoolbus.app  (Meera)")
    print(f"  bus_id={bus_b_id} route_id={route_b_id} customer_id={cid_b}")
    print()
    print("Isolation check: login as admin@schoolbus.app and GET /api/buses")
    print("  must return only BUS-101 — never BUS-202.")
    print("  Then run: PYTHONPATH=. python check_tenant_isolation.py")
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())

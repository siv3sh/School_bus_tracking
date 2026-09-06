"""Prove School A tenant scope cannot see School B data.

Run after seed:

  cd backend && PYTHONPATH=. python check_tenant_isolation.py
"""

import asyncio
import sys

from app.database import close_db, get_db
from app.models.schemas import user_from_doc
from app.services.tenant import tenant_scope_for_user


async def _ids(cursor) -> set[str]:
    docs = await cursor.to_list(500)
    return {str(d["_id"]) for d in docs}


async def main() -> int:
    db = get_db()
    admin_a = await db.users.find_one({"email": "admin@schoolbus.app"})
    admin_b = await db.users.find_one({"email": "admin.b@schoolbus.app"})
    if not admin_a or not admin_b:
        print("FAIL: seed both customers first (PYTHONPATH=. python seed.py)")
        await close_db()
        return 1

    user_a = user_from_doc(admin_a)
    user_b = user_from_doc(admin_b)
    # Passing School B's id must be ignored for a customer_admin.
    scope_a = tenant_scope_for_user(user_a, acting_customer_id=user_b.customer_id)
    scope_b = tenant_scope_for_user(user_b, acting_customer_id=user_a.customer_id)

    if scope_a.customer_id != user_a.customer_id or scope_a.on_behalf_of is not None:
        print("FAIL: School A scope leaked acting_customer_id override")
        await close_db()
        return 1
    if scope_b.customer_id != user_b.customer_id:
        print("FAIL: School B scope leaked acting_customer_id override")
        await close_db()
        return 1

    buses_a = await _ids(db.buses.find(scope_a.mongo_filter()))
    buses_b = await _ids(db.buses.find(scope_b.mongo_filter()))
    routes_a = await _ids(db.routes.find(scope_a.mongo_filter()))
    routes_b = await _ids(db.routes.find(scope_b.mongo_filter()))
    students_a = await _ids(db.students.find(scope_a.mongo_filter()))
    students_b = await _ids(db.students.find(scope_b.mongo_filter()))

    leaked_bus = await db.buses.find_one(scope_a.mongo_filter({"bus_number": "BUS-202"}))

    failures: list[str] = []
    if not buses_a or not buses_b:
        failures.append("expected each school to have at least one bus")
    if buses_a & buses_b:
        failures.append(f"bus overlap: {buses_a & buses_b}")
    if routes_a & routes_b:
        failures.append(f"route overlap: {routes_a & routes_b}")
    if students_a & students_b:
        failures.append(f"student overlap: {students_a & students_b}")
    if leaked_bus is not None:
        failures.append("School A filter returned School B bus BUS-202")

    if failures:
        print("FAIL:")
        for item in failures:
            print(" ", item)
        await close_db()
        return 1

    print("PASS: customer_admin tenant scope isolates School A from School B")
    print(f"  A buses={len(buses_a)} routes={len(routes_a)} students={len(students_a)}")
    print(f"  B buses={len(buses_b)} routes={len(routes_b)} students={len(students_b)}")
    await close_db()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

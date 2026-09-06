import { NextResponse } from "next/server";

import { fastapiFetch, parseJson } from "@/lib/api/server";
import type { CustomerPublic, SessionPayload, UserPublic } from "@/lib/api/types";
import { clearActingCustomerCookie, clearTokenCookie, getActingCustomerId, getTokenCookie } from "@/lib/auth/cookies";

export async function GET() {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const meResponse = await fastapiFetch("/api/auth/me", { token });
  if (meResponse.status === 401 || meResponse.status === 403) {
    await clearTokenCookie();
    await clearActingCustomerCookie();
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }
  const user = await parseJson<UserPublic>(meResponse);

  let actingCustomer: CustomerPublic | null = null;
  const actingId = await getActingCustomerId();
  if (user.role === "product_admin" && actingId) {
    const customerResponse = await fastapiFetch(`/api/platform/customers/${actingId}`, { token });
    if (customerResponse.ok) {
      actingCustomer = await parseJson<CustomerPublic>(customerResponse);
    }
  }

  const payload: SessionPayload = { user, actingCustomer };
  return NextResponse.json(payload);
}

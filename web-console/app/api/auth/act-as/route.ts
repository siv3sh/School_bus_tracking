import { NextRequest, NextResponse } from "next/server";

import { ApiError, fastapiFetch, parseJson } from "@/lib/api/server";
import type { CustomerPublic, UserPublic } from "@/lib/api/types";
import {
  clearActingCustomerCookie,
  getTokenCookie,
  setActingCustomerCookie,
} from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  try {
    const meResponse = await fastapiFetch("/api/auth/me", { token });
    const user = await parseJson<UserPublic>(meResponse);
    if (user.role !== "product_admin") {
      return NextResponse.json({ detail: "Only product admins can act as a school" }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { customer_id?: string | null } | null;
    const customerId = body?.customer_id ?? null;
    if (!customerId) {
      await clearActingCustomerCookie();
      return NextResponse.json({ actingCustomer: null });
    }

    const customerResponse = await fastapiFetch(`/api/platform/customers/${customerId}`, { token });
    const customer = await parseJson<CustomerPublic>(customerResponse);
    await setActingCustomerCookie(customer.id);
    return NextResponse.json({ actingCustomer: customer });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    throw error;
  }
}

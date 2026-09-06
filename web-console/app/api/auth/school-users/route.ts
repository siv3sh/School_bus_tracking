import { NextRequest, NextResponse } from "next/server";

import { fastapiFetch } from "@/lib/api/server";
import { getTokenCookie } from "@/lib/auth/cookies";

export async function GET(request: NextRequest) {
  const token = await getTokenCookie();
  if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const customerId = request.nextUrl.searchParams.get("customer_id");
  if (!customerId) return NextResponse.json({ detail: "customer_id is required" }, { status: 400 });
  const response = await fastapiFetch("/api/school/users", { token, customerId });
  const payload = await response.arrayBuffer();
  return new NextResponse(payload, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

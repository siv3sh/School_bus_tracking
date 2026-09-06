import { NextResponse } from "next/server";

import { fastapiFetch } from "@/lib/api/server";
import { getTokenCookie } from "@/lib/auth/cookies";

async function unscopedGet(path: string) {
  const token = await getTokenCookie();
  if (!token) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  const response = await fastapiFetch(path, { token });
  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET() {
  return unscopedGet("/api/buses");
}

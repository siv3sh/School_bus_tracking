import { NextResponse } from "next/server";

import { clearActingCustomerCookie, clearTokenCookie } from "@/lib/auth/cookies";

export async function POST() {
  await clearTokenCookie();
  await clearActingCustomerCookie();
  return NextResponse.json({ ok: true });
}

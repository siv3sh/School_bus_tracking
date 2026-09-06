import { NextRequest, NextResponse } from "next/server";

import { ApiError, fastapiFetch, jsonBody, parseJson } from "@/lib/api/server";
import type { TokenResponse } from "@/lib/api/types";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.invite_token !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ detail: "Invite token and password are required" }, { status: 400 });
  }

  const response = await fastapiFetch("/api/auth/accept-invite", {
    method: "POST",
    ...jsonBody({ invite_token: body.invite_token, password: body.password }),
  });

  try {
    const payload = await parseJson<TokenResponse>(response);
    return NextResponse.json({ user: payload.user });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    throw error;
  }
}

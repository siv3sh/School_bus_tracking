import { NextRequest, NextResponse } from "next/server";

import { readApiError } from "@/lib/api/errors";
import { ApiError, fastapiFetch, jsonBody, parseJson } from "@/lib/api/server";
import type { TokenResponse } from "@/lib/api/types";
import { setTokenCookie } from "@/lib/auth/cookies";
import { isConsoleRole } from "@/lib/auth/jwt";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ detail: "Email and password are required" }, { status: 400 });
  }

  try {
    const response = await fastapiFetch("/api/auth/login", {
      method: "POST",
      ...jsonBody({ email: body.email, password: body.password }),
    });

    if (!response.ok) {
      const error = await readApiError(response);
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }

    const payload = await parseJson<TokenResponse>(response);
    if (!isConsoleRole(payload.user.role)) {
      return NextResponse.json(
        {
          code: "MOBILE_ONLY",
          detail: "Please use the School Bus mobile app",
        },
        { status: 403 },
      );
    }

    await setTokenCookie(payload.access_token);
    return NextResponse.json({ user: payload.user });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.detail }, { status: error.status });
    }
    throw error;
  }
}

import { NextRequest, NextResponse } from "next/server";

import { fastapiFetch } from "@/lib/api/server";
import { getActingCustomerId, getTokenCookie } from "@/lib/auth/cookies";

export const maxDuration = 60;

async function proxy(request: NextRequest, path: string[]) {
  const token = await getTokenCookie();
  if (!token) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const search = request.nextUrl.search;
  const targetPath = `/api/${path.join("/")}${search}`;
  const actingCustomerId = await getActingCustomerId();
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await fastapiFetch(targetPath, {
    method: request.method,
    token,
    customerId: actingCustomerId,
    headers,
    body: hasBody ? await request.text() : undefined,
  });

  const payload = await response.arrayBuffer();
  const outHeaders = new Headers();
  const responseType = response.headers.get("content-type");
  if (responseType) outHeaders.set("content-type", responseType);
  return new NextResponse(payload, { status: response.status, headers: outHeaders });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, path);
}

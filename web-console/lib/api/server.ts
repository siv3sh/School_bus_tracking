import { ApiError, isConnectionError, readApiError } from "@/lib/api/errors";

const FASTAPI_URL = process.env.FASTAPI_URL ?? "http://localhost:8000";

export function fastapiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${FASTAPI_URL}${normalized}`;
}

export async function fastapiFetch(
  path: string,
  init: RequestInit & { token?: string | null; customerId?: string | null } = {},
): Promise<Response> {
  const { token, customerId, headers, ...rest } = init;
  const nextHeaders = new Headers(headers);
  if (!nextHeaders.has("accept")) nextHeaders.set("accept", "application/json");
  if (token) nextHeaders.set("authorization", `Bearer ${token}`);
  if (customerId) nextHeaders.set("X-Customer-Id", customerId);
  try {
    return await fetch(fastapiUrl(path), {
      ...rest,
      headers: nextHeaders,
      cache: "no-store",
    });
  } catch (error) {
    if (isConnectionError(error) || (error instanceof Error && error.message === "fetch failed")) {
      throw new ApiError(
        503,
        `Cannot reach the API at ${FASTAPI_URL}. Start FastAPI on that URL, then try again.`,
      );
    }
    throw error;
  }
}

export async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw await readApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function jsonBody(body: unknown): { headers: HeadersInit; body: string } {
  return {
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export { ApiError };

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const cause = "cause" in error ? (error as { cause?: { code?: string } }).cause : undefined;
  const code = cause?.code ?? ("code" in error ? String((error as { code?: string }).code) : "");
  return code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ECONNRESET" || code === "ETIMEDOUT";
}

function detailFromBody(body: unknown): string {
  if (!body || typeof body !== "object") return "Request failed";
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      })
      .join("; ");
  }
  return "Request failed";
}

export async function readApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return new ApiError(response.status, detailFromBody(body));
}

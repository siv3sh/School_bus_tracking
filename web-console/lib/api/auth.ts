import { api } from "@/lib/api/client";
import type {
  CustomerPublic,
  InviteCreatedResponse,
  SessionPayload,
  UserPublic,
  UserStatus,
} from "@/lib/api/types";

export function fetchSession() {
  return fetch("/api/auth/session", { credentials: "include", cache: "no-store" }).then(async (res) => {
    if (res.status === 401) return null;
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(body?.detail ?? "Failed to load session");
    }
    return (await res.json()) as SessionPayload;
  });
}

export function loginRequest(email: string, password: string) {
  return fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then(async (res) => {
    const body = (await res.json().catch(() => null)) as
      | { user?: UserPublic; code?: string; detail?: string }
      | null;
    if (!res.ok) {
      const error = new Error(body?.detail ?? "Login failed") as Error & { code?: string; status: number };
      error.code = body?.code;
      error.status = res.status;
      throw error;
    }
    return body as { user: UserPublic };
  });
}

export function logoutRequest() {
  return fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export function acceptInviteRequest(invite_token: string, password: string) {
  return fetch("/api/auth/accept-invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ invite_token, password }),
  }).then(async (res) => {
    const body = (await res.json().catch(() => null)) as { user?: UserPublic; detail?: string } | null;
    if (!res.ok) throw new Error(body?.detail ?? "Invite could not be accepted");
    return body as { user: UserPublic };
  });
}

export function actAsCustomer(customerId: string | null) {
  return fetch("/api/auth/act-as", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ customer_id: customerId }),
  }).then(async (res) => {
    const body = (await res.json().catch(() => null)) as { actingCustomer?: CustomerPublic | null; detail?: string } | null;
    if (!res.ok) throw new Error(body?.detail ?? "Could not change school scope");
    return body as { actingCustomer: CustomerPublic | null };
  });
}

export function resendInvite(userId: string) {
  return api.post<{ ok: true; invite_token: string; invite_expires_at: string }>("/auth/resend-invite", {
    user_id: userId,
  });
}

export function updateUserStatus(userId: string, status: Exclude<UserStatus, "invited">) {
  return api.patch<UserPublic>(`/school/users/${userId}/status`, { status });
}

export function createSchoolUser(body: {
  name: string;
  email: string;
  role: "driver" | "parent";
  phone?: string | null;
  password?: string | null;
}) {
  return api.post<InviteCreatedResponse>("/school/users", body);
}

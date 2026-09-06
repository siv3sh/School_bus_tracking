import { CUSTOMER_STATUSES, ROLES, USER_STATUSES, type Role, type UserStatus } from "@/lib/api/types";

export type AccessTokenClaims = {
  sub: string;
  role: Role;
  email: string;
  customer_id: string | null;
  status: UserStatus;
  exp: number;
};

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

function isUserStatus(value: unknown): value is UserStatus {
  return typeof value === "string" && (USER_STATUSES as readonly string[]).includes(value);
}

export function decodeAccessToken(token: string): AccessTokenClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const json = JSON.parse(atob(padded)) as Record<string, unknown>;
    if (!isRole(json.role) || !isUserStatus(json.status) || typeof json.sub !== "string") {
      return null;
    }
    const exp = typeof json.exp === "number" ? json.exp : Number(json.exp);
    if (!Number.isFinite(exp)) return null;
    return {
      sub: json.sub,
      role: json.role,
      email: typeof json.email === "string" ? json.email : "",
      customer_id: typeof json.customer_id === "string" ? json.customer_id : null,
      status: json.status,
      exp,
    };
  } catch {
    return null;
  }
}

export function isTokenExpired(claims: AccessTokenClaims, skewSeconds = 30): boolean {
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

export function homePathForRole(role: Role): "/platform/dashboard" | "/school/dashboard" | null {
  switch (role) {
    case "product_admin":
      return "/platform/dashboard";
    case "customer_admin":
      return "/school/dashboard";
    case "driver":
    case "parent":
      return null;
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

export function isConsoleRole(role: Role): boolean {
  return homePathForRole(role) !== null;
}

export function isCustomerStatus(value: string): value is (typeof CUSTOMER_STATUSES)[number] {
  return (CUSTOMER_STATUSES as readonly string[]).includes(value);
}

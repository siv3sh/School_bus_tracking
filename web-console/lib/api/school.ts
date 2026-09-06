import { api } from "@/lib/api/client";
import type { UserPublic } from "@/lib/api/types";

export function listSchoolUsers() {
  return api.get<UserPublic[]>("/school/users");
}

export async function listUsersForCustomer(customerId: string) {
  const response = await fetch(`/api/auth/school-users?customer_id=${encodeURIComponent(customerId)}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Could not load school users");
  }
  return (await response.json()) as UserPublic[];
}

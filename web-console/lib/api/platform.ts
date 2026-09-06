import { api } from "@/lib/api/client";
import type {
  AuditLogPublic,
  BusPublic,
  CustomerCreate,
  CustomerCreatedResponse,
  CustomerPublic,
  CustomerStatusUpdate,
} from "@/lib/api/types";

export function listCustomers() {
  return api.get<CustomerPublic[]>("/platform/customers");
}

export function getCustomer(customerId: string) {
  return api.get<CustomerPublic>(`/platform/customers/${customerId}`);
}

export function createCustomer(body: CustomerCreate) {
  return api.post<CustomerCreatedResponse>("/platform/customers", body);
}

export function updateCustomerStatus(customerId: string, body: CustomerStatusUpdate) {
  return api.patch<CustomerPublic>(`/platform/customers/${customerId}/status`, body);
}

async function nextJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "Request failed");
  }
  return (await response.json()) as T;
}

export function listPlatformBuses() {
  return nextJson<BusPublic[]>("/api/auth/platform-buses");
}

export function listPlatformAuditLogs() {
  return nextJson<AuditLogPublic[]>("/api/auth/platform-audit");
}

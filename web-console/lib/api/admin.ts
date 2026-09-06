import { api } from "@/lib/api/client";
import type {
  AlertLogPublic,
  AuditLogPublic,
  BusAssign,
  BusCreate,
  BusPublic,
  RouteCreate,
  RoutePublic,
  SchoolContact,
  StudentCreate,
  StudentPublic,
  UserPublic,
} from "@/lib/api/types";

export function listRoutes() {
  return api.get<RoutePublic[]>("/admin/routes");
}

export function createRoute(body: RouteCreate) {
  return api.post<RoutePublic>("/admin/routes", body);
}

export function updateRoute(routeId: string, body: RouteCreate) {
  return api.put<RoutePublic>(`/admin/routes/${routeId}`, body);
}

export function createBus(body: BusCreate) {
  return api.post<BusPublic>("/admin/buses", body);
}

export function assignBus(busId: string, body: BusAssign) {
  return api.put<BusPublic>(`/admin/buses/${busId}/assign`, body);
}

export function listDrivers() {
  return api.get<UserPublic[]>("/admin/drivers");
}

export function listAlerts() {
  return api.get<AlertLogPublic[]>("/admin/alerts");
}

export function listAuditLogs() {
  return api.get<AuditLogPublic[]>("/admin/audit");
}

export function listStudents() {
  return api.get<StudentPublic[]>("/admin/students");
}

export function createStudent(body: StudentCreate) {
  return api.post<StudentPublic>("/admin/students", body);
}

export function issueWsTicket() {
  return api.post<{ access_token: string; token_type: string; expires_in: number }>("/auth/ws-ticket");
}

export function getSchoolContact() {
  return api.get<SchoolContact>("/auth/school-contact");
}

export function listBuses() {
  return api.get<BusPublic[]>("/buses");
}

export function getBus(busId: string) {
  return api.get<BusPublic>(`/buses/${busId}`);
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../config/env";
import type {
  AlertLog,
  AuditLog,
  Bus,
  ChildBundle,
  DriverBusPayload,
  Route,
  SchoolContact,
  User,
} from "../types";

const TOKEN_KEY = "auth_token";

let authToken: string | null = null;

export async function loadStoredToken(): Promise<string | null> {
  authToken = await AsyncStorage.getItem(TOKEN_KEY);
  return authToken;
}

export async function setAuthToken(token: string | null): Promise<void> {
  authToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const url = `${API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new Error(`Cannot reach API at ${API_URL}. Is the backend running on your Wi‑Fi?`);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `API returned non-JSON (${res.status}) from ${url}. Check apiUrl and that uvicorn is up.`,
      );
    }
  }
  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string") throw new Error(detail);
    if (Array.isArray(detail) && detail[0]?.msg) throw new Error(String(detail[0].msg));
    throw new Error(`Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<User>("/api/auth/me"),
  updatePushToken: (expo_push_token: string) =>
    request<User>("/api/auth/push-token", {
      method: "POST",
      body: JSON.stringify({ expo_push_token }),
    }),
  updatePrefs: (alert_minutes_before: number) =>
    request<User>("/api/auth/prefs", {
      method: "PUT",
      body: JSON.stringify({ alert_minutes_before }),
    }),
  schoolContact: () => request<SchoolContact>("/api/auth/school-contact"),
  postLatestLocation: (body: {
    bus_id: string;
    lat: number;
    lng: number;
    speed: number | null;
    recorded_at: string;
  }) =>
    request<{ ok: boolean; bus: Bus }>("/api/location/latest", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  myBus: () => request<DriverBusPayload>("/api/buses/mine"),
  startTrip: (busId: string) =>
    request<{ ok: boolean; trip_id: string; bus: Bus }>(`/api/buses/${busId}/start-trip`, { method: "POST" }),
  endTrip: (busId: string) => request<{ ok: boolean; bus: Bus }>(`/api/buses/${busId}/end-trip`, { method: "POST" }),
  markStopReached: (busId: string) =>
    request<{ ok: boolean; bus: Bus; route: Route | null; next_stop: StopLike | null }>(
      `/api/buses/${busId}/mark-stop-reached`,
      { method: "POST" },
    ),
  broadcast: (busId: string, body: { type: "delay" | "emergency"; message: string }) =>
    request<{ ok: boolean; notified: number }>(`/api/buses/${busId}/broadcast`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  boardStudent: (busId: string, student_id: string, boarded: boolean) =>
    request<{ ok: boolean }>(`/api/buses/${busId}/board-student`, {
      method: "POST",
      body: JSON.stringify({ student_id, boarded }),
    }),
  listBuses: () => request<Bus[]>("/api/buses"),
  getBus: (busId: string) => request<Bus>(`/api/buses/${busId}`),
  parentChildren: () => request<ChildBundle[]>("/api/parent/children"),
  parentSetBoarded: (studentId: string, boarded: boolean) =>
    request<{ ok: boolean; student: ChildBundle["student"] }>(`/api/parent/students/${studentId}/board`, {
      method: "POST",
      body: JSON.stringify({ boarded }),
    }),
  parentAlerts: () => request<AlertLog[]>("/api/parent/alerts"),
  adminRoutes: () => request<Route[]>("/api/admin/routes"),
  createRoute: (body: { name: string; stops: Route["stops"]; schedule?: string }) =>
    request<Route>("/api/admin/routes", { method: "POST", body: JSON.stringify(body) }),
  updateRoute: (routeId: string, body: { name: string; stops: Route["stops"]; schedule?: string }) =>
    request<Route>(`/api/admin/routes/${routeId}`, { method: "PUT", body: JSON.stringify(body) }),
  listDrivers: () => request<User[]>("/api/admin/drivers"),
  assignBus: (busId: string, body: { driver_id?: string | null; route_id?: string | null }) =>
    request<Bus>(`/api/admin/buses/${busId}/assign`, { method: "PUT", body: JSON.stringify(body) }),
  adminAlerts: () => request<AlertLog[]>("/api/admin/alerts"),
  adminAudit: () => request<AuditLog[]>("/api/admin/audit"),
};

type StopLike = { stop_id: string; name: string; lat: number; lng: number; sequence_number: number; reached?: boolean };

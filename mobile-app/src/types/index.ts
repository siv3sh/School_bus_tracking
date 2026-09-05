export type Role = "driver" | "parent" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  expo_push_token?: string | null;
  alert_minutes_before?: number;
};

export type Stop = {
  stop_id: string;
  name: string;
  lat: number;
  lng: number;
  sequence_number: number;
  reached?: boolean;
};

export type Route = {
  id: string;
  name: string;
  stops: Stop[];
  schedule?: "morning" | "evening" | "both";
};

export type Bus = {
  id: string;
  bus_number: string;
  driver_id?: string | null;
  route_id?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;
  last_updated_at?: string | null;
  status: "active" | "inactive" | "signal_lost";
  is_stale: boolean;
  trip_active: boolean;
  next_stop_sequence?: number;
  current_trip_id?: string | null;
  last_speed?: number | null;
};

export type PendingPoint = {
  lat: number;
  lng: number;
  speed: number | null;
  recorded_at: string;
  bus_id: string;
};

export type AlertLog = {
  id: string;
  bus_id: string;
  stop_id?: string | null;
  parent_id: string;
  sent_at: string;
  type: string;
  trip_id?: string | null;
  message?: string | null;
};

export type EtaInfo = {
  distance_m: number;
  eta_minutes: number | null;
  eta_source: string;
  target?: string;
  target_name?: string | null;
};

export type ChildBundle = {
  student: {
    id: string;
    name: string;
    parent_id: string;
    route_id: string;
    stop_id: string;
    boarded?: boolean;
  };
  bus: Bus | null;
  route: Route | null;
  stop: Stop | null;
  eta?: EtaInfo | null;
  school_arrived?: boolean;
};

export type SchoolContact = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

export type AuditLog = {
  id: string;
  actor_id: string;
  actor_role: string;
  action: string;
  bus_id?: string | null;
  meta?: Record<string, unknown>;
  created_at: string;
};

export type DriverBusPayload = {
  bus: Bus;
  route: Route | null;
  next_stop?: Stop | null;
  students?: ChildBundle["student"][];
};

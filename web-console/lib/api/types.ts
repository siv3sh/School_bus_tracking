export const ROLES = ["product_admin", "customer_admin", "driver", "parent"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["invited", "active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CUSTOMER_STATUSES = ["pending", "active", "suspended"] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const BUS_STATUSES = ["active", "inactive", "signal_lost"] as const;
export type BusStatus = (typeof BUS_STATUSES)[number];

export const ROUTE_SCHEDULES = ["morning", "evening", "both"] as const;
export type RouteSchedule = (typeof ROUTE_SCHEDULES)[number];

export type UserPublic = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  expo_push_token?: string | null;
  alert_minutes_before: number;
  customer_id?: string | null;
  status: UserStatus;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: UserPublic;
};

export type CustomerPublic = {
  id: string;
  name: string;
  city: string;
  contact_email: string;
  contact_phone?: string | null;
  status: CustomerStatus;
  created_at: string;
  created_by: string;
};

export type CustomerCreate = {
  name: string;
  city: string;
  contact_email: string;
  contact_phone?: string | null;
  admin_name: string;
  admin_email: string;
};

export type CustomerCreatedResponse = {
  customer: CustomerPublic;
  admin: UserPublic;
  invite_token: string;
  invite_expires_at: string;
};

export type CustomerStatusUpdate = {
  status: Exclude<CustomerStatus, "pending">;
};

export type SchoolUserCreate = {
  name: string;
  email: string;
  role: Extract<Role, "driver" | "parent">;
  phone?: string | null;
  password?: string | null;
};

export type InviteCreatedResponse = {
  user: UserPublic;
  invite_token?: string | null;
  invite_expires_at?: string | null;
};

export type UserStatusUpdate = {
  status: Exclude<UserStatus, "invited">;
};

export type StopEmbedded = {
  stop_id: string;
  name: string;
  lat: number;
  lng: number;
  sequence_number: number;
  reached?: boolean;
};

export type RouteCreate = {
  name: string;
  stops: StopEmbedded[];
  schedule: RouteSchedule;
};

export type RoutePublic = {
  id: string;
  name: string;
  stops: StopEmbedded[];
  schedule: RouteSchedule;
  customer_id?: string | null;
};

export type BusCreate = {
  bus_number: string;
  driver_id?: string | null;
  route_id?: string | null;
};

export type BusAssign = {
  driver_id?: string | null;
  route_id?: string | null;
};

export type BusPublic = {
  id: string;
  bus_number: string;
  driver_id?: string | null;
  route_id?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;
  last_updated_at?: string | null;
  status: BusStatus;
  is_stale: boolean;
  trip_active: boolean;
  next_stop_sequence: number;
  current_trip_id?: string | null;
  customer_id?: string | null;
};

export type StudentCreate = {
  name: string;
  parent_id: string;
  route_id: string;
  stop_id: string;
};

export type StudentPublic = {
  id: string;
  name: string;
  parent_id: string;
  route_id: string;
  stop_id: string;
  boarded: boolean;
  customer_id?: string | null;
};

export type AlertLogPublic = {
  id: string;
  bus_id: string;
  stop_id?: string | null;
  parent_id: string;
  sent_at: string;
  type: string;
  trip_id?: string | null;
  message?: string | null;
  customer_id?: string | null;
};

export type AuditLogPublic = {
  id: string;
  customer_id?: string | null;
  actor_user_id: string;
  actor_role: string;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  on_behalf_of?: string | null;
  created_at: string;
};

export type SchoolContact = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

export type SessionPayload = {
  user: UserPublic;
  actingCustomer: CustomerPublic | null;
};

export const BACKEND_GAPS = {
  updateStudent: {
    needed: "PATCH /api/admin/students/{id}",
    have: "create and list only",
  },
  updateBusNumber: {
    needed: "PATCH /api/admin/buses/{id}",
    have: "POST /api/admin/buses and PUT /api/admin/buses/{id}/assign",
  },
  updateSchoolContact: {
    needed: "PATCH /api/platform/customers/{id} (name/city/contact)",
    have: "GET /api/auth/school-contact (read-only) and PATCH status only",
  },
  auditFilters: {
    needed: "GET /api/admin/audit?customer_id&actor&action&from&to",
    have: "GET /api/admin/audit — latest 300 rows, no query filters",
  },
  dashboardStats: {
    needed: "dedicated stats endpoints",
    have: "derived client-side from customers, buses, and alerts lists",
  },
} as const;

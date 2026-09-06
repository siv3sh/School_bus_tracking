import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const acceptInviteSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm your password"),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const customerCreateSchema = z.object({
  name: z.string().min(2, "School name is required"),
  city: z.string().min(2, "City is required"),
  contact_email: z.string().email("Enter a valid contact email"),
  contact_phone: z.string().optional().or(z.literal("")),
  admin_name: z.string().min(2, "Admin name is required"),
  admin_email: z.string().email("Enter a valid admin email"),
});

export const schoolUserSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional().or(z.literal("")),
  password: z
    .string()
    .refine((value) => value.length === 0 || value.length >= 8, "Password must be at least 8 characters"),
});

export const busCreateSchema = z.object({
  bus_number: z.string().min(1, "Bus number is required"),
  driver_id: z.string().optional().or(z.literal("")),
  route_id: z.string().optional().or(z.literal("")),
});

export const busAssignSchema = z.object({
  driver_id: z.string().optional().or(z.literal("")),
  route_id: z.string().optional().or(z.literal("")),
});

export const routeFormSchema = z.object({
  name: z.string().min(2, "Route name is required"),
  schedule: z.enum(["morning", "evening", "both"]),
});

export const stopFormSchema = z.object({
  name: z.string().min(1, "Stop name is required"),
  lat: z.coerce.number().gte(-90).lte(90),
  lng: z.coerce.number().gte(-180).lte(180),
});

export const studentCreateSchema = z.object({
  name: z.string().min(2, "Student name is required"),
  parent_id: z.string().min(1, "Select a parent"),
  route_id: z.string().min(1, "Select a route"),
  stop_id: z.string().min(1, "Select a stop"),
});

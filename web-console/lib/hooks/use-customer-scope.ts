"use client";

import { useAuth } from "@/lib/hooks/use-auth";

export function useCustomerScope() {
  const { user, actingCustomer } = useAuth();
  const isImpersonating = user?.role === "product_admin" && Boolean(actingCustomer);
  return {
    customerId: actingCustomer?.id ?? user?.customer_id ?? null,
    customerName: actingCustomer?.name ?? null,
    isImpersonating,
    actingCustomer,
  };
}

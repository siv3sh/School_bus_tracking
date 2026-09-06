"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { actAsCustomer, fetchSession, loginRequest, logoutRequest } from "@/lib/api/auth";
import { homePathForRole } from "@/lib/auth/jwt";

export const sessionQueryKey = ["session"] as const;

export function useAuth() {
  const query = useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchSession,
    retry: false,
    staleTime: 30_000,
  });

  return {
    user: query.data?.user ?? null,
    actingCustomer: query.data?.actingCustomer ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => loginRequest(email, password),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      const home = homePathForRole(data.user.role);
      router.replace(home ?? "/unauthorized");
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });
}

export function useActAs() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (customerId: string | null) => actAsCustomer(customerId),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      router.replace(data.actingCustomer ? "/school/dashboard" : "/platform/dashboard");
    },
  });
}

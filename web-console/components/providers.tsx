"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/errors";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (count, error) => {
              if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                return false;
              }
              return count < 1;
            },
            refetchOnWindowFocus: false,
            staleTime: 15_000,
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

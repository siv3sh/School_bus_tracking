"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Sidebar } from "@/components/shared/sidebar";
import { TopBar } from "@/components/shared/top-bar";
import { Button } from "@/components/ui/button";
import { useActAs, useAuth } from "@/lib/hooks/use-auth";
import { useCustomerScope } from "@/lib/hooks/use-customer-scope";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { isImpersonating, actingCustomer } = useCustomerScope();
  const actAs = useActAs();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, router, user]);

  if (isLoading || !user) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar role={user.role} />
        </div>
      </aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative h-full w-64">
            <Sidebar role={user.role} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setOpen(true)} />
        {isImpersonating && actingCustomer ? (
          <div className="flex items-center justify-between gap-3 bg-pending px-4 py-2 text-sm text-white">
            <p>
              Viewing as: <strong>{actingCustomer.name}</strong>
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => actAs.mutate(null)}
              disabled={actAs.isPending}
            >
              <X className="size-4" />
              Exit
            </Button>
          </div>
        ) : null}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

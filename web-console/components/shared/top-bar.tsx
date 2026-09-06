"use client";

import { LogOut, Menu } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/format";
import { useAuth, useLogout } from "@/lib/hooks/use-auth";
import { useCustomerScope } from "@/lib/hooks/use-customer-scope";

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user } = useAuth();
  const { isImpersonating, actingCustomer } = useCustomerScope();
  const logout = useLogout();

  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b bg-card px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}>
          <Menu className="size-4" />
        </Button>
        {isImpersonating && actingCustomer ? (
          <p className="truncate text-sm text-muted-foreground">
            Viewing as <span className="font-medium text-foreground">{actingCustomer.name}</span>
          </p>
        ) : (
          <p className="truncate text-sm text-muted-foreground">School operations</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
            </div>
            <StatusBadge value={user.role} label={roleLabel(user.role)} />
          </>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut className="size-4" />
          Log out
        </Button>
      </div>
    </header>
  );
}

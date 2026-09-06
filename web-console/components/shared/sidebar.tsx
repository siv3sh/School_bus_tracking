"use client";

import {
  Bell,
  Bus,
  Building2,
  LayoutDashboard,
  MapPinned,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

const PLATFORM_NAV: NavItem[] = [
  { href: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/platform/customers", label: "Customers", icon: Building2 },
  { href: "/platform/audit-log", label: "Audit log", icon: ScrollText },
];

const SCHOOL_NAV: NavItem[] = [
  { href: "/school/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/school/buses", label: "Buses", icon: Bus },
  { href: "/school/routes", label: "Routes & stops", icon: MapPinned },
  { href: "/school/drivers", label: "Drivers", icon: Users },
  { href: "/school/parents", label: "Parents & students", icon: Users },
  { href: "/school/alerts", label: "Alerts", icon: Bell },
  { href: "/school/settings", label: "School settings", icon: Settings },
];

export function Sidebar({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = role === "product_admin" && pathname.startsWith("/platform") ? PLATFORM_NAV : SCHOOL_NAV;

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
          SB
        </div>
        <div>
          <p className="text-sm font-semibold">School Bus</p>
          <p className="text-xs text-sidebar-foreground/60">Tracking console</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-muted text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-muted hover:text-white",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

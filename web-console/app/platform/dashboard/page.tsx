"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, Bus, Clock } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BackendGap } from "@/components/shared/backend-gap";
import { ErrorState, TableSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api/errors";
import { listCustomers, listPlatformBuses } from "@/lib/api/platform";
import { formatDate } from "@/lib/format";

function monthKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(date);
}

export default function PlatformDashboardPage() {
  const customersQuery = useQuery({ queryKey: ["platform", "customers"], queryFn: listCustomers });
  const busesQuery = useQuery({ queryKey: ["platform", "buses"], queryFn: listPlatformBuses });

  const error = customersQuery.error ?? busesQuery.error;
  if (error instanceof ApiError && error.status === 403) {
    return <ErrorState title="Not authorized" description={error.detail} />;
  }

  const customers = customersQuery.data ?? [];
  const buses = busesQuery.data ?? [];
  const chart = Object.entries(
    customers.reduce<Record<string, number>>((acc, customer) => {
      const key = monthKey(customer.created_at);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, signups]) => ({ name, signups }));

  return (
    <div className="space-y-6">
      <PageHeader title="Platform" description="Schools, fleet activity, and recent signups across tenants." />
      <BackendGap gap="dashboardStats" extra="Live websocket updates are not used here; bus counts come from GET /api/buses." />
      {customersQuery.isLoading || busesQuery.isLoading ? (
        <TableSkeleton rows={3} />
      ) : customersQuery.isError ? (
        <ErrorState description={customersQuery.error.message} onRetry={() => customersQuery.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Schools" value={customers.length} icon={Building2} />
            <StatCard
              title="Active"
              value={customers.filter((c) => c.status === "active").length}
              icon={Activity}
              hint={`${customers.filter((c) => c.status === "pending").length} pending · ${customers.filter((c) => c.status === "suspended").length} suspended`}
            />
            <StatCard
              title="Live buses"
              value={buses.filter((b) => b.trip_active && !b.is_stale).length}
              icon={Bus}
              hint={`${buses.length} total across the platform`}
            />
            <StatCard title="Pending schools" value={customers.filter((c) => c.status === "pending").length} icon={Clock} />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>School signups</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {chart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="signups" fill="#0f766e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">No customers yet.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Recent signups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {customers.slice(0, 8).map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {customer.city} · {formatDate(customer.created_at)}
                      </p>
                    </div>
                    <StatusBadge value={customer.status} />
                  </div>
                ))}
                {!customers.length ? <p className="text-sm text-muted-foreground">No schools yet.</p> : null}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

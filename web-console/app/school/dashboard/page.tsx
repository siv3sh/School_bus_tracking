"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, Bus, GraduationCap, Radio } from "lucide-react";
import dynamic from "next/dynamic";

import { ErrorState, TableSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAlerts, listStudents } from "@/lib/api/admin";
import { isSameDay } from "@/lib/format";
import { useCustomerScope } from "@/lib/hooks/use-customer-scope";
import { useLiveBuses } from "@/lib/hooks/use-live-buses";

const MapView = dynamic(() => import("@/components/shared/map-view").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-muted" />,
});

export default function SchoolDashboardPage() {
  const { actingCustomer } = useCustomerScope();
  const busesQuery = useLiveBuses();
  const alertsQuery = useQuery({ queryKey: ["school", "alerts"], queryFn: listAlerts });
  const studentsQuery = useQuery({ queryKey: ["school", "students"], queryFn: listStudents });

  if (busesQuery.isError) {
    return <ErrorState description={busesQuery.error.message} onRetry={() => busesQuery.refetch()} />;
  }

  const buses = busesQuery.data ?? [];
  const live = buses.filter((bus) => bus.trip_active && !bus.is_stale);
  const alertsToday = (alertsQuery.data ?? []).filter((alert) => isSameDay(alert.sent_at));

  return (
    <div className="space-y-6">
      <PageHeader
        title={actingCustomer?.name ?? "School dashboard"}
        description="Live buses for this tenant. GPS freshness uses the backend is_stale flag (stale after 60s)."
        actions={
          <StatusBadge
            value={busesQuery.socketLive ? "live" : "offline"}
            label={busesQuery.socketLive ? "Live feed" : "Polling"}
          />
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Active trips" value={buses.filter((b) => b.trip_active).length} hint="Buses with trip_active" icon={Bus} />
        <StatCard title="Alerts today" value={alertsToday.length} icon={Bell} />
        <StatCard
          title="Students"
          value={studentsQuery.data?.length ?? "—"}
          hint={studentsQuery.isError ? studentsQuery.error.message : undefined}
          icon={GraduationCap}
        />
      </div>
      {busesQuery.isLoading ? (
        <TableSkeleton />
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <MapView buses={buses} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Fleet status
                <Radio className={`size-4 ${busesQuery.socketLive ? "text-live" : "text-muted-foreground"}`} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {buses.map((bus) => (
                <div key={bus.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{bus.bus_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {bus.trip_active ? (bus.is_stale ? "Stale GPS" : "Trip active") : "Idle"}
                    </p>
                  </div>
                  <StatusBadge
                    value={bus.trip_active ? (bus.is_stale ? "offline" : "live") : "inactive"}
                    label={bus.trip_active ? (bus.is_stale ? "Offline" : "Live") : "Idle"}
                  />
                </div>
              ))}
              {!buses.length ? <p className="text-sm text-muted-foreground">No buses yet.</p> : null}
              <p className="text-xs text-muted-foreground">{live.length} live right now</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

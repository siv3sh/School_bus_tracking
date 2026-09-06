"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Bell } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { listAlerts, listBuses, listRoutes } from "@/lib/api/admin";
import type { AlertLogPublic } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

export default function AlertsPage() {
  const alertsQuery = useQuery({ queryKey: ["school", "alerts"], queryFn: listAlerts });
  const busesQuery = useQuery({ queryKey: ["school", "buses"], queryFn: listBuses });
  const routesQuery = useQuery({ queryKey: ["school", "routes"], queryFn: listRoutes });
  const [date, setDate] = useState("");
  const [busId, setBusId] = useState("");
  const [stopId, setStopId] = useState("");

  const columns = useMemo<ColumnDef<AlertLogPublic>[]>(
    () => {
      const stopName = (id?: string | null) => {
        for (const route of routesQuery.data ?? []) {
          const stop = route.stops.find((item) => item.stop_id === id);
          if (stop) return stop.name;
        }
        return id || "—";
      };
      return [
      {
        accessorKey: "sent_at",
        header: "Sent",
        cell: ({ row }) => formatDateTime(row.original.sent_at),
      },
      { accessorKey: "type", header: "Type" },
      {
        id: "bus",
        header: "Bus",
        accessorFn: (row) => busesQuery.data?.find((bus) => bus.id === row.bus_id)?.bus_number ?? row.bus_id,
      },
      {
        id: "stop",
        header: "Stop",
        accessorFn: (row) => stopName(row.stop_id),
      },
      { accessorKey: "parent_id", header: "Parent" },
      { accessorKey: "message", header: "Message" },
    ];
    },
    [busesQuery.data, routesQuery.data],
  );

  const rows = (alertsQuery.data ?? []).filter((row) => {
    if (busId && row.bus_id !== busId) return false;
    if (stopId && row.stop_id !== stopId) return false;
    if (date && !row.sent_at.startsWith(date)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Alerts log" description="ETA warnings and broadcasts for this school. Filter client-side; the API has no query params." />
      <div className="grid gap-2 sm:grid-cols-3">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input placeholder="Bus id" value={busId} onChange={(e) => setBusId(e.target.value)} />
        <Input placeholder="Stop id" value={stopId} onChange={(e) => setStopId(e.target.value)} />
      </div>
      {alertsQuery.isLoading ? (
        <TableSkeleton />
      ) : alertsQuery.isError ? (
        <ErrorState description={alertsQuery.error.message} onRetry={() => alertsQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search alerts…"
          empty={
            <EmptyState
              icon={Bell}
              title="No alerts yet"
              description="ETA ‘bus almost here’ events and delay/emergency broadcasts will appear here."
            />
          }
        />
      )}
    </div>
  );
}

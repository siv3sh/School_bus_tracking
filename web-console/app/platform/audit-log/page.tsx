"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ScrollText } from "lucide-react";
import { useMemo, useState } from "react";

import { BackendGap } from "@/components/shared/backend-gap";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { listPlatformAuditLogs } from "@/lib/api/platform";
import type { AuditLogPublic } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

export default function AuditLogPage() {
  const query = useQuery({ queryKey: ["platform", "audit"], queryFn: listPlatformAuditLogs });
  const [customer, setCustomer] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = (query.data ?? []).filter((row) => {
    if (customer && !(row.customer_id ?? "").includes(customer)) return false;
    if (actor && !(row.actor_user_id ?? "").includes(actor) && !(row.actor_role ?? "").includes(actor)) return false;
    if (action && !(row.action ?? "").includes(action)) return false;
    const created = row.created_at ? new Date(row.created_at).getTime() : 0;
    if (from && created < new Date(from).getTime()) return false;
    if (to && created > new Date(`${to}T23:59:59`).getTime()) return false;
    return true;
  });

  const columns = useMemo<ColumnDef<AuditLogPublic>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "When",
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
      { accessorKey: "action", header: "Action" },
      { accessorKey: "actor_role", header: "Actor role" },
      { accessorKey: "actor_user_id", header: "Actor" },
      { accessorKey: "customer_id", header: "Customer" },
      { accessorKey: "target_type", header: "Target" },
      { accessorKey: "target_id", header: "Target id" },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Writes already exist; this list is GET /api/admin/audit." />
      <BackendGap gap="auditFilters" extra="Product admin with no school scope receives unscoped rows (latest 300)." />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input placeholder="Customer id" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        <Input placeholder="Actor id or role" value={actor} onChange={(e) => setActor(e.target.value)} />
        <Input placeholder="Action" value={action} onChange={(e) => setAction(e.target.value)} />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {query.isLoading ? (
        <TableSkeleton />
      ) : query.isError ? (
        <ErrorState description={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search audit rows…"
          empty={
            <EmptyState
              icon={ScrollText}
              title="No audit events"
              description="Actions such as creating a school or inviting a user will show up here."
            />
          }
        />
      )}
    </div>
  );
}

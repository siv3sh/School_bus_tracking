"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ErrorState, TableSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listUsersForCustomer } from "@/lib/api/school";
import { getCustomer, updateCustomerStatus } from "@/lib/api/platform";
import { formatDate } from "@/lib/format";
import { useActAs } from "@/lib/hooks/use-auth";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const actAs = useActAs();
  const customerQuery = useQuery({
    queryKey: ["platform", "customers", id],
    queryFn: () => getCustomer(id),
  });
  const usersQuery = useQuery({
    queryKey: ["platform", "customer-users", id],
    queryFn: () => listUsersForCustomer(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "suspended") => updateCustomerStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "customers"] });
      toast.success("Customer status updated");
    },
    onError: (error) => toast.error(error.message),
  });

  if (customerQuery.isLoading) return <TableSkeleton rows={4} />;
  if (customerQuery.isError || !customerQuery.data) {
    return <ErrorState description={customerQuery.error?.message ?? "Customer not found"} />;
  }

  const customer = customerQuery.data;
  const admins = (usersQuery.data ?? []).filter((user) => user.role === "customer_admin");

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={`${customer.city} · created ${formatDate(customer.created_at)}`}
        actions={
          <>
            <Button onClick={() => actAs.mutate(customer.id)} disabled={actAs.isPending}>
              Act as this school
            </Button>
            {customer.status === "suspended" ? (
              <ConfirmDialog
                title="Reactivate school?"
                description="School admins, drivers, and parents will be able to sign in again."
                confirmLabel="Reactivate"
                onConfirm={() => statusMutation.mutate("active")}
                pending={statusMutation.isPending}
                trigger={<Button variant="outline">Reactivate</Button>}
              />
            ) : (
              <ConfirmDialog
                title="Suspend this school?"
                description="Users bound to this customer will be blocked from signing in."
                confirmLabel="Suspend"
                destructive
                onConfirm={() => statusMutation.mutate("suspended")}
                pending={statusMutation.isPending}
                trigger={<Button variant="destructive">Suspend</Button>}
              />
            )}
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>School</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Status" value={<StatusBadge value={customer.status} />} />
            <Row label="Contact email" value={customer.contact_email} />
            <Row label="Contact phone" value={customer.contact_phone || "—"} />
            <Row label="Created by" value={customer.created_by} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>School admins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {usersQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading users…</p>
            ) : usersQuery.isError ? (
              <p className="text-sm text-destructive">{usersQuery.error.message}</p>
            ) : admins.length ? (
              admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{admin.name}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                  <StatusBadge value={admin.status} />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No customer admins returned for this school.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

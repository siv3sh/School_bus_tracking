"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { BackendGap } from "@/components/shared/backend-gap";
import { ErrorState, TableSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSchoolContact } from "@/lib/api/admin";
import { roleLabel } from "@/lib/format";
import { useAuth } from "@/lib/hooks/use-auth";

export default function SettingsPage() {
  const { user } = useAuth();
  const contactQuery = useQuery({ queryKey: ["school", "contact"], queryFn: getSchoolContact });

  return (
    <div className="space-y-6">
      <PageHeader title="School settings" description="Contact details come from the customer record via GET /api/auth/school-contact." />
      <BackendGap gap="updateSchoolContact" />
      {contactQuery.isLoading ? (
        <TableSkeleton rows={3} />
      ) : contactQuery.isError ? (
        <ErrorState description={contactQuery.error.message} onRetry={() => contactQuery.refetch()} />
      ) : contactQuery.data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>School contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Name" value={contactQuery.data.name} />
              <Row label="Phone" value={contactQuery.data.phone} />
              <Row label="Email" value={contactQuery.data.email} />
              <Row label="Address / city" value={contactQuery.data.address} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Your account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Name" value={user?.name ?? "—"} />
              <Row label="Email" value={user?.email ?? "—"} />
              <Row label="Role" value={user ? roleLabel(user.role) : "—"} />
              <Row label="Status" value={user ? <StatusBadge value={user.status} /> : "—"} />
            </CardContent>
          </Card>
        </div>
      ) : null}
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

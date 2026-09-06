"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCustomer, listCustomers } from "@/lib/api/platform";
import type { CustomerPublic, CustomerStatus } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { customerCreateSchema } from "@/lib/validators/forms";

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CustomerStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["platform", "customers"], queryFn: listCustomers });
  const form = useForm<z.infer<typeof customerCreateSchema>>({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: {
      name: "",
      city: "",
      contact_email: "",
      contact_phone: "",
      admin_name: "",
      admin_email: "",
    },
  });
  const create = useMutation({
    mutationFn: (values: z.infer<typeof customerCreateSchema>) =>
      createCustomer({
        ...values,
        contact_phone: values.contact_phone || null,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["platform", "customers"] });
      setInviteUrl(`${window.location.origin}/accept-invite?token=${result.invite_token}`);
      toast.success(`Invited ${result.admin.email}`);
      form.reset();
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = (query.data ?? []).filter((row) => status === "all" || row.status === status);
  const columns = useMemo<ColumnDef<CustomerPublic>[]>(
    () => [
      {
        accessorKey: "name",
        header: "School",
        cell: ({ row }) => (
          <Link href={`/platform/customers/${row.original.id}`} className="font-medium hover:underline">
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "city", header: "City" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge value={row.original.status} />,
      },
      { accessorKey: "contact_email", header: "Admin contact" },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ row }) => formatDate(row.original.created_at),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Every school tenant on the platform."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Create school</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create school</DialogTitle>
              </DialogHeader>
              <form className="grid gap-3" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
                <Field label="School name" error={form.formState.errors.name?.message}>
                  <Input {...form.register("name")} />
                </Field>
                <Field label="City" error={form.formState.errors.city?.message}>
                  <Input {...form.register("city")} />
                </Field>
                <Field label="Contact email" error={form.formState.errors.contact_email?.message}>
                  <Input type="email" {...form.register("contact_email")} />
                </Field>
                <Field label="Contact phone">
                  <Input {...form.register("contact_phone")} />
                </Field>
                <Field label="First admin name" error={form.formState.errors.admin_name?.message}>
                  <Input {...form.register("admin_name")} />
                </Field>
                <Field label="First admin email" error={form.formState.errors.admin_email?.message}>
                  <Input type="email" {...form.register("admin_email")} />
                </Field>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Creating…" : "Create and invite"}
                </Button>
                {inviteUrl ? (
                  <p className="break-all rounded-md bg-muted px-3 py-2 text-xs">
                    Invite link: {inviteUrl}
                  </p>
                ) : null}
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <Select value={status} onValueChange={(value) => setStatus(value as CustomerStatus | "all")}>
        <SelectTrigger className="w-40 bg-card">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="suspended">Suspended</SelectItem>
        </SelectContent>
      </Select>
      {query.isLoading ? (
        <TableSkeleton />
      ) : query.isError ? (
        <ErrorState description={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search schools…"
          empty={
            <EmptyState
              icon={Building2}
              title="No schools yet"
              description="Create a school to invite its first customer admin."
            />
          }
        />
      )}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

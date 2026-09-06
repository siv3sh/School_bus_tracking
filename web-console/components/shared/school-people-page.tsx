"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSchoolUser, resendInvite, updateUserStatus } from "@/lib/api/auth";
import { listSchoolUsers } from "@/lib/api/school";
import type { UserPublic } from "@/lib/api/types";
import { schoolUserSchema } from "@/lib/validators/forms";

export function SchoolPeoplePage({
  title,
  description,
  role,
  emptyTitle,
  emptyDescription,
  extra,
}: {
  title: string;
  description: string;
  role: "driver" | "parent";
  emptyTitle: string;
  emptyDescription: string;
  extra?: ReactNode;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["school", "users"], queryFn: listSchoolUsers });
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schoolUserSchema>>({
    resolver: zodResolver(schoolUserSchema),
    defaultValues: { name: "", email: "", phone: "", password: "" },
  });

  const invite = useMutation({
    mutationFn: (values: z.infer<typeof schoolUserSchema>) =>
      createSchoolUser({
        name: values.name,
        email: values.email,
        role,
        phone: values.phone || null,
        password: values.password || null,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["school", "users"] });
      if (result.invite_token) {
        setInviteUrl(`${window.location.origin}/accept-invite?token=${result.invite_token}`);
      }
      toast.success(`Created ${result.user.email}`);
      form.reset();
    },
    onError: (error) => toast.error(error.message),
  });

  const resend = useMutation({
    mutationFn: (userId: string) => resendInvite(userId),
    onSuccess: (result) => {
      setInviteUrl(`${window.location.origin}/accept-invite?token=${result.invite_token}`);
      toast.success("Invite resent");
    },
    onError: (error) => toast.error(error.message),
  });

  const status = useMutation({
    mutationFn: ({ userId, next }: { userId: string; next: "active" | "suspended" }) =>
      updateUserStatus(userId, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school", "users"] });
      toast.success("User status updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = (query.data ?? []).filter((user) => user.role === role);
  const columns = useMemo<ColumnDef<UserPublic>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "phone", header: "Phone" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge value={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-2">
            {row.original.status === "invited" ? (
              <Button size="sm" variant="outline" onClick={() => resend.mutate(row.original.id)}>
                Resend
              </Button>
            ) : null}
            {row.original.status === "suspended" ? (
              <ConfirmDialog
                title="Reactivate user?"
                description={`${row.original.name} will be able to sign in again.`}
                confirmLabel="Reactivate"
                onConfirm={() => status.mutate({ userId: row.original.id, next: "active" })}
                pending={status.isPending}
                trigger={
                  <Button size="sm" variant="outline">
                    Reactivate
                  </Button>
                }
              />
            ) : row.original.status === "active" ? (
              <ConfirmDialog
                title="Suspend user?"
                description={`${row.original.name} will be blocked from signing in.`}
                confirmLabel="Suspend"
                destructive
                onConfirm={() => status.mutate({ userId: row.original.id, next: "suspended" })}
                pending={status.isPending}
                trigger={
                  <Button size="sm" variant="destructive">
                    Suspend
                  </Button>
                }
              />
            ) : null}
          </div>
        ),
      },
    ],
    [resend, status],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Invite {role}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite {role}</DialogTitle>
              </DialogHeader>
              <form className="grid gap-3" onSubmit={form.handleSubmit((values) => invite.mutate(values))}>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input {...form.register("name")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" {...form.register("email")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input {...form.register("phone")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Password (optional)</Label>
                  <Input type="password" {...form.register("password")} />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to send an invite instead of activating immediately.
                  </p>
                </div>
                <Button type="submit" disabled={invite.isPending}>
                  {invite.isPending ? "Saving…" : "Create"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      {inviteUrl ? <p className="break-all rounded-md bg-muted px-3 py-2 text-xs">Invite link: {inviteUrl}</p> : null}
      {extra}
      {query.isLoading ? (
        <TableSkeleton />
      ) : query.isError ? (
        <ErrorState description={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder={`Search ${role}s…`}
          empty={<EmptyState icon={Users} title={emptyTitle} description={emptyDescription} />}
        />
      )}
    </div>
  );
}

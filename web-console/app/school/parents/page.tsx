"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { GraduationCap } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/empty-state";
import { SchoolPeoplePage } from "@/components/shared/school-people-page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createStudent, listRoutes, listStudents } from "@/lib/api/admin";
import { listSchoolUsers } from "@/lib/api/school";
import type { StudentPublic } from "@/lib/api/types";
import { studentCreateSchema } from "@/lib/validators/forms";

export default function ParentsPage() {
  return (
    <SchoolPeoplePage
      title="Parents & students"
      description="Invite parents, then add students linked to a parent, route, and stop."
      role="parent"
      emptyTitle="No parents yet"
      emptyDescription="Invite a parent first, then add their student."
      extra={
        <>
          <StudentRoster />
          <StudentCreateCard />
        </>
      }
    />
  );
}

function StudentRoster() {
  const studentsQuery = useQuery({ queryKey: ["school", "students"], queryFn: listStudents });
  const usersQuery = useQuery({ queryKey: ["school", "users"], queryFn: listSchoolUsers });
  const routesQuery = useQuery({ queryKey: ["school", "routes"], queryFn: listRoutes });
  const columns = useMemo<ColumnDef<StudentPublic>[]>(
    () => [
      { accessorKey: "name", header: "Student" },
      {
        id: "parent",
        header: "Parent",
        accessorFn: (row) => usersQuery.data?.find((user) => user.id === row.parent_id)?.name ?? row.parent_id,
      },
      {
        id: "route",
        header: "Route",
        accessorFn: (row) => routesQuery.data?.find((route) => route.id === row.route_id)?.name ?? row.route_id,
      },
      { accessorKey: "stop_id", header: "Stop" },
      {
        accessorKey: "boarded",
        header: "Boarded",
        cell: ({ row }) => (row.original.boarded ? "Yes" : "No"),
      },
    ],
    [routesQuery.data, usersQuery.data],
  );

  if (studentsQuery.isLoading) return <TableSkeleton />;
  if (studentsQuery.isError) {
    return <ErrorState description={studentsQuery.error.message} onRetry={() => studentsQuery.refetch()} />;
  }

  return (
    <DataTable
      columns={columns}
      data={studentsQuery.data ?? []}
      searchPlaceholder="Search students…"
      empty={
        <EmptyState
          icon={GraduationCap}
          title="No students yet"
          description="Add a student linked to a parent, route, and stop."
        />
      }
    />
  );
}

function StudentCreateCard() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["school", "users"], queryFn: listSchoolUsers });
  const routesQuery = useQuery({ queryKey: ["school", "routes"], queryFn: listRoutes });
  const form = useForm<z.infer<typeof studentCreateSchema>>({
    resolver: zodResolver(studentCreateSchema),
    defaultValues: { name: "", parent_id: "", route_id: "", stop_id: "" },
  });
  const create = useMutation({
    mutationFn: (values: z.infer<typeof studentCreateSchema>) => createStudent(values),
    onSuccess: (student) => {
      toast.success(`Added ${student.name}`);
      queryClient.invalidateQueries({ queryKey: ["school", "students"] });
      form.reset({ name: "", parent_id: "", route_id: "", stop_id: "" });
    },
    onError: (error) => toast.error(error.message),
  });
  const parents = (usersQuery.data ?? []).filter((user) => user.role === "parent");
  const routes = routesQuery.data ?? [];
  const selectedRoute = routes.find((route) => route.id === form.watch("route_id"));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add student</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
          <div className="space-y-1.5">
            <Label>Student name</Label>
            <Input {...form.register("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Parent</Label>
            <Select value={form.watch("parent_id")} onValueChange={(value) => form.setValue("parent_id", value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                {parents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Route</Label>
            <Select
              value={form.watch("route_id")}
              onValueChange={(value) => {
                form.setValue("route_id", value);
                form.setValue("stop_id", "");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select route" />
              </SelectTrigger>
              <SelectContent>
                {routes.map((route) => (
                  <SelectItem key={route.id} value={route.id}>
                    {route.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Stop</Label>
            <Select value={form.watch("stop_id")} onValueChange={(value) => form.setValue("stop_id", value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select stop" />
              </SelectTrigger>
              <SelectContent>
                {(selectedRoute?.stops ?? []).map((stop) => (
                  <SelectItem key={stop.stop_id} value={stop.stop_id}>
                    {stop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Add student"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

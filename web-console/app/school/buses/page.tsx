"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Bus } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { BackendGap } from "@/components/shared/backend-gap";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignBus, createBus, listBuses, listDrivers, listRoutes } from "@/lib/api/admin";
import type { BusPublic } from "@/lib/api/types";
import { busAssignSchema, busCreateSchema } from "@/lib/validators/forms";

export default function BusesPage() {
  const queryClient = useQueryClient();
  const busesQuery = useQuery({ queryKey: ["school", "buses"], queryFn: listBuses, refetchInterval: 8000 });
  const driversQuery = useQuery({ queryKey: ["school", "drivers"], queryFn: listDrivers });
  const routesQuery = useQuery({ queryKey: ["school", "routes"], queryFn: listRoutes });
  const [createOpen, setCreateOpen] = useState(false);
  const [assigning, setAssigning] = useState<BusPublic | null>(null);

  const createForm = useForm<z.infer<typeof busCreateSchema>>({
    resolver: zodResolver(busCreateSchema),
    defaultValues: { bus_number: "", driver_id: "", route_id: "" },
  });
  const assignForm = useForm<z.infer<typeof busAssignSchema>>({
    resolver: zodResolver(busAssignSchema),
    defaultValues: { driver_id: "", route_id: "" },
  });

  const create = useMutation({
    mutationFn: (values: z.infer<typeof busCreateSchema>) =>
      createBus({
        bus_number: values.bus_number,
        driver_id: values.driver_id || null,
        route_id: values.route_id || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school", "buses"] });
      toast.success("Bus created");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (error) => toast.error(error.message),
  });

  const assign = useMutation({
    mutationFn: (values: z.infer<typeof busAssignSchema>) => {
      if (!assigning) throw new Error("No bus selected");
      return assignBus(assigning.id, {
        driver_id: values.driver_id || null,
        route_id: values.route_id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school", "buses"] });
      toast.success("Assignment saved");
      setAssigning(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const columns = useMemo<ColumnDef<BusPublic>[]>(
    () => {
      const driverName = (id?: string | null) => driversQuery.data?.find((d) => d.id === id)?.name ?? "—";
      const routeName = (id?: string | null) => routesQuery.data?.find((r) => r.id === id)?.name ?? "—";
      return [
      { accessorKey: "bus_number", header: "Bus" },
      {
        id: "driver",
        header: "Driver",
        accessorFn: (row) => driverName(row.driver_id),
      },
      {
        id: "route",
        header: "Route",
        accessorFn: (row) => routeName(row.route_id),
      },
      {
        id: "live",
        header: "Live",
        cell: ({ row }) => (
          <StatusBadge
            value={row.original.trip_active ? (row.original.is_stale ? "offline" : "live") : "inactive"}
            label={row.original.trip_active ? (row.original.is_stale ? "Offline" : "Live") : "Idle"}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAssigning(row.original);
              assignForm.reset({
                driver_id: row.original.driver_id ?? "",
                route_id: row.original.route_id ?? "",
              });
            }}
          >
            Assign
          </Button>
        ),
      },
    ];
    },
    [assignForm, driversQuery.data, routesQuery.data],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buses"
        description="Create buses and assign a driver plus route."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add bus</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add bus</DialogTitle>
              </DialogHeader>
              <form className="grid gap-3" onSubmit={createForm.handleSubmit((values) => create.mutate(values))}>
                <div className="space-y-1.5">
                  <Label>Bus number</Label>
                  <Input {...createForm.register("bus_number")} />
                </div>
                <DriverRouteFields
                  drivers={driversQuery.data ?? []}
                  routes={routesQuery.data ?? []}
                  driverId={createForm.watch("driver_id") ?? ""}
                  routeId={createForm.watch("route_id") ?? ""}
                  onDriver={(value) => createForm.setValue("driver_id", value)}
                  onRoute={(value) => createForm.setValue("route_id", value)}
                />
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Saving…" : "Create bus"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <BackendGap gap="updateBusNumber" />
      {busesQuery.isLoading ? (
        <TableSkeleton />
      ) : busesQuery.isError ? (
        <ErrorState description={busesQuery.error.message} onRetry={() => busesQuery.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={busesQuery.data ?? []}
          searchPlaceholder="Search buses…"
          empty={
            <EmptyState
              icon={Bus}
              title="No buses yet"
              description="Create your first bus, then assign a driver and route."
            />
          }
        />
      )}
      <Dialog open={Boolean(assigning)} onOpenChange={(open) => !open && setAssigning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {assigning?.bus_number}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={assignForm.handleSubmit((values) => assign.mutate(values))}>
            <DriverRouteFields
              drivers={driversQuery.data ?? []}
              routes={routesQuery.data ?? []}
              driverId={assignForm.watch("driver_id") ?? ""}
              routeId={assignForm.watch("route_id") ?? ""}
              onDriver={(value) => assignForm.setValue("driver_id", value)}
              onRoute={(value) => assignForm.setValue("route_id", value)}
            />
            <Button type="submit" disabled={assign.isPending}>
              {assign.isPending ? "Saving…" : "Save assignment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DriverRouteFields({
  drivers,
  routes,
  driverId,
  routeId,
  onDriver,
  onRoute,
}: {
  drivers: { id: string; name: string }[];
  routes: { id: string; name: string }[];
  driverId: string;
  routeId: string;
  onDriver: (value: string) => void;
  onRoute: (value: string) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Driver</Label>
        <Select value={driverId || "none"} onValueChange={(value) => onDriver(value === "none" ? "" : value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {drivers.map((driver) => (
              <SelectItem key={driver.id} value={driver.id}>
                {driver.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Route</Label>
        <Select value={routeId || "none"} onValueChange={(value) => onRoute(value === "none" ? "" : value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {routes.map((route) => (
              <SelectItem key={route.id} value={route.id}>
                {route.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { MapPinned, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { DataTable } from "@/components/shared/data-table";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createRoute, listRoutes, updateRoute } from "@/lib/api/admin";
import type { RoutePublic, StopEmbedded } from "@/lib/api/types";
import { routeFormSchema, stopFormSchema } from "@/lib/validators/forms";

const StopPickerMap = dynamic(
  () => import("@/components/shared/stop-picker-map").then((mod) => mod.StopPickerMap),
  { ssr: false },
);

export default function RoutesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["school", "routes"], queryFn: listRoutes });
  const [editing, setEditing] = useState<RoutePublic | null | "new">(null);

  const columns = useMemo<ColumnDef<RoutePublic>[]>(
    () => [
      { accessorKey: "name", header: "Route" },
      { accessorKey: "schedule", header: "Schedule" },
      {
        id: "stops",
        header: "Stops",
        accessorFn: (row) => row.stops.length,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button size="sm" variant="outline" onClick={() => setEditing(row.original)}>
            Edit
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routes & stops"
        description="Ordered stops with coordinates. Click the map to place a stop."
        actions={<Button onClick={() => setEditing("new")}>Create route</Button>}
      />
      {query.isLoading ? (
        <TableSkeleton />
      ) : query.isError ? (
        <ErrorState description={query.error.message} onRetry={() => query.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          searchPlaceholder="Search routes…"
          empty={
            <EmptyState
              icon={MapPinned}
              title="No routes yet"
              description="Create your first route and add stops on the map."
            />
          }
        />
      )}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" || !editing ? "Create route" : `Edit ${editing.name}`}</DialogTitle>
          </DialogHeader>
          {editing !== null ? (
            <RouteEditor
              route={editing === "new" ? null : editing}
              onSaved={() => {
                queryClient.invalidateQueries({ queryKey: ["school", "routes"] });
                setEditing(null);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RouteEditor({ route, onSaved }: { route: RoutePublic | null; onSaved: () => void }) {
  const form = useForm<z.infer<typeof routeFormSchema>>({
    resolver: zodResolver(routeFormSchema),
    defaultValues: { name: route?.name ?? "", schedule: route?.schedule ?? "morning" },
  });
  const [stops, setStops] = useState<StopEmbedded[]>(route?.stops ?? []);
  const [draft, setDraft] = useState({ name: "", lat: 12.9716, lng: 77.5946 });

  const save = useMutation({
    mutationFn: (values: z.infer<typeof routeFormSchema>) => {
      const payload = {
        name: values.name,
        schedule: values.schedule,
        stops: stops.map((stop, index) => ({ ...stop, sequence_number: index + 1 })),
      };
      return route ? updateRoute(route.id, payload) : createRoute(payload);
    },
    onSuccess: () => {
      toast.success(route ? "Route updated" : "Route created");
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });

  function addStop() {
    const parsed = stopFormSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid stop");
      return;
    }
    setStops((current) => [
      ...current,
      {
        stop_id: crypto.randomUUID(),
        name: parsed.data.name,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        sequence_number: current.length + 1,
        reached: false,
      },
    ]);
    setDraft((current) => ({ ...current, name: "" }));
  }

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input {...form.register("name")} />
      </div>
      <div className="space-y-1.5">
        <Label>Schedule</Label>
        <Select value={form.watch("schedule")} onValueChange={(value) => form.setValue("schedule", value as "morning" | "evening" | "both")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="morning">Morning</SelectItem>
            <SelectItem value="evening">Evening</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Add stop</Label>
        <StopPickerMap lat={draft.lat} lng={draft.lng} onPick={(lat, lng) => setDraft((c) => ({ ...c, lat, lng }))} />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Stop name" value={draft.name} onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))} />
          <Button type="button" variant="outline" onClick={addStop}>
            Add stop
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)} — click the map to move the marker.
        </p>
      </div>
      <ol className="space-y-2">
        {stops.map((stop, index) => (
          <li key={stop.stop_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>
              {index + 1}. {stop.name}
            </span>
            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setStops((c) => c.filter((s) => s.stop_id !== stop.stop_id))}>
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ol>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save route"}
      </Button>
    </form>
  );
}

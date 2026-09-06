import { AlertTriangle } from "lucide-react";

import { BACKEND_GAPS } from "@/lib/api/types";

export function BackendGap({
  gap,
  extra,
}: {
  gap: keyof typeof BACKEND_GAPS;
  extra?: string;
}) {
  const item = BACKEND_GAPS[gap];
  return (
    <div className="flex gap-3 rounded-lg border border-pending/30 bg-pending/10 px-3 py-2 text-sm text-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-pending" />
      <div>
        <p className="font-medium">Backend gap</p>
        <p className="text-muted-foreground">
          Needs {item.needed}. Currently: {item.have}.
          {extra ? ` ${extra}` : ""}
        </p>
      </div>
    </div>
  );
}

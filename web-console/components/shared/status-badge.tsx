"use client";

import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusStyles = cva("border-transparent", {
  variants: {
    tone: {
      live: "bg-live/15 text-live",
      pending: "bg-pending/15 text-pending",
      alert: "bg-alert/15 text-alert",
      muted: "bg-secondary text-secondary-foreground",
    },
  },
  defaultVariants: { tone: "muted" },
});

type Tone = NonNullable<VariantProps<typeof statusStyles>["tone"]>;

function toneFor(value: string): Tone {
  switch (value) {
    case "active":
    case "live":
      return "live";
    case "pending":
    case "invited":
    case "inactive":
    case "offline":
      return "pending";
    case "suspended":
    case "signal_lost":
    case "alert":
      return "alert";
    default:
      return "muted";
  }
}

export function StatusBadge({ value, label }: { value: string; label?: string }) {
  return (
    <Badge variant="secondary" className={cn(statusStyles({ tone: toneFor(value) }))}>
      {label ?? titleCase(value)}
    </Badge>
  );
}

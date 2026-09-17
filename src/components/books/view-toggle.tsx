"use client";

import { Grid3x3, LayoutGrid } from "lucide-react";
import type { View } from "@/lib/books";
import { cn } from "@/lib/utils";
import { useSetParam } from "./use-set-param";

const OPTIONS = [
  { view: "grid", label: "Grid view", Icon: LayoutGrid },
  { view: "wall", label: "Cover wall", Icon: Grid3x3 },
] as const;

/* Two pressed-state buttons rather than tabs: there is no second panel. */
export function ViewToggle({ view }: { view: View }) {
  const setParam = useSetParam();

  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex rounded-md border bg-card p-0.5 shadow-xs"
    >
      {OPTIONS.map(({ view: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          aria-label={label}
          // "grid" is the default, so it clears the param.
          onClick={() => setParam("view", v === "grid" ? undefined : v)}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-sm transition-colors",
            view === v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}

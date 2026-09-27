"use client";

import { Grid3x3, LayoutGrid, List } from "lucide-react";
import type { View } from "@/lib/books";
import { cn } from "@/lib/utils";
import { useSetParam } from "./use-set-param";

const OPTIONS = [
  { view: "grid", label: "Grid view", Icon: LayoutGrid },
  { view: "wall", label: "Cover wall", Icon: Grid3x3 },
  { view: "list", label: "List view", Icon: List },
] as const;

/* Pressed-state buttons rather than tabs: there is no second panel. */
export function ViewToggle({
  view,
  views,
}: {
  view: View;
  /** Which views this shelf offers — see SHELF_VIEWS. */
  views: readonly View[];
}) {
  const setParam = useSetParam();

  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex rounded-md border bg-card p-0.5 shadow-xs"
    >
      {OPTIONS.filter((o) => views.includes(o.view)).map(({ view: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          aria-label={label}
          // "grid" is the default, so it clears the param.
          onClick={() => setParam("view", v === "grid" ? undefined : v)}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
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

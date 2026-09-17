"use client";

import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_SORT,
  SHELF_SORTS,
  SORTS,
  STATUSES,
  STATUS_LABELS,
  type Shelf,
} from "@/lib/books";
import type { ShelfFilters, StatusCounts } from "@/lib/shelf";
import { cn } from "@/lib/utils";
import { useSetParam } from "./use-set-param";

const SELECT_CLASS = "min-w-0 flex-1 basis-36 lg:w-48 lg:flex-none";

/*
 * Sort/filter state lives in the URL, so the server component does the work,
 * the view is shareable, and the back button behaves. No client store.
 *
 * Status chips are plain aria-pressed buttons, not Radix tabs: tabs activate
 * on arrow-key focus, which would fire a navigation per keypress.
 */
export function ShelfToolbar({
  shelf,
  filters,
  counts,
  subjects,
  collections,
  count,
}: {
  shelf: Shelf;
  filters: ShelfFilters;
  /** Library: status chips. Wishlist: null. */
  counts: StatusCounts | null;
  subjects: string[];
  collections: { id: string; name: string }[];
  /** Number of visible books (shown on wishlist only). */
  count: number;
}) {
  const setParam = useSetParam();

  // A subject from the URL that isn't in the top list still needs an item,
  // otherwise the trigger would render blank.
  const subjectOptions =
    filters.subject && !subjects.includes(filters.subject)
      ? [filters.subject, ...subjects]
      : subjects;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {counts ? (
          <div
            role="group"
            aria-label="Filter by status"
            className="flex flex-wrap items-center gap-2"
          >
            {([undefined, ...STATUSES] as const).map((s) => (
              <button
                key={s ?? "all"}
                type="button"
                aria-pressed={filters.status === s}
                onClick={() => setParam("status", s)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                  filters.status === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                )}
              >
                {s ? STATUS_LABELS[s] : "All"}
                <span className="tabular-nums opacity-70">{counts[s ?? "all"]}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? "book" : "books"}
          </p>
        )}

        {filters.author && (
          <button
            type="button"
            aria-label={`Remove author filter: ${filters.author}`}
            onClick={() => setParam("author", undefined)}
            className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-primary/40 px-3 text-sm text-primary transition-colors hover:bg-accent"
          >
            <span className="truncate">by {filters.author}</span>
            <X className="size-3.5 shrink-0" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {subjectOptions.length > 0 && (
          <Select
            value={filters.subject ?? "all"}
            onValueChange={(v) => setParam("subject", v)}
          >
            <SelectTrigger size="sm" className={SELECT_CLASS} aria-label="Filter by subject">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {subjectOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {collections.length > 0 && (
          <Select
            value={filters.collection ?? "all"}
            onValueChange={(v) => setParam("collection", v)}
          >
            <SelectTrigger
              size="sm"
              className={SELECT_CLASS}
              aria-label="Filter by collection"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All collections</SelectItem>
              {collections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={filters.sort}
          onValueChange={(v) => setParam("sort", v === DEFAULT_SORT[shelf] ? undefined : v)}
        >
          <SelectTrigger size="sm" className={SELECT_CLASS} aria-label="Sort books">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHELF_SORTS[shelf].map((key) => (
              <SelectItem key={key} value={key}>
                {SORTS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

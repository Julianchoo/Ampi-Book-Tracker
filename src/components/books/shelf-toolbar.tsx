"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORTS, STATUSES, STATUS_LABELS, type SortKey } from "@/lib/books";

/*
 * Sort/filter state lives in the URL, so the server component does the work,
 * the view is shareable, and the back button behaves. No client store.
 */
export function ShelfToolbar({
  sort,
  status,
  showStatusFilter = true,
  count,
}: {
  sort: SortKey;
  status: string | undefined;
  showStatusFilter?: boolean;
  count: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || !value) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-auto text-sm text-muted-foreground">
        {count} {count === 1 ? "book" : "books"}
      </p>

      {showStatusFilter && (
        <Select
          value={status ?? "all"}
          onValueChange={(v) => setParam("status", v)}
        >
          <SelectTrigger size="sm" className="w-[9.5rem]" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
        <SelectTrigger size="sm" className="w-[11rem]" aria-label="Sort books">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SORTS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

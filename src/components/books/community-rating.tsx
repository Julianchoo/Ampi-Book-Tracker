import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Deliberately no star glyph and no --star gold: those mean "your rating".
 * This is an outside reference on a different (1–5) scale.
 *
 * Shown from a single rating: Open Library data is sparse, and the count is
 * printed alongside so "5.0 · 1 rating" reads for what it is. The ≥5 floor
 * (hasCommunityRating) still gates sorting and the "best rated" highlight.
 * `checked` with no ratings says so; never checked renders nothing.
 */
export function CommunityRating({
  rating,
  count,
  checked = false,
  className,
}: {
  rating: number | null;
  count: number | null;
  checked?: boolean;
  className?: string;
}) {
  if (rating == null || count == null || count < 1) {
    if (!checked) return null;
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        <span className="inline-flex items-center gap-1">
          <Users aria-hidden className="size-3" />
          No Open Library ratings
        </span>
      </p>
    );
  }

  const value = rating.toFixed(1);
  const ratings = `${count.toLocaleString("en-GB")} ${count === 1 ? "rating" : "ratings"}`;

  return (
    <p className={cn("text-xs text-muted-foreground tabular-nums", className)}>
      <span aria-hidden className="inline-flex items-center gap-1">
        <Users className="size-3" />
        {value}/5 · {ratings}
      </span>
      <span className="sr-only">
        Open Library community rating {value} out of 5 from {ratings}
      </span>
    </p>
  );
}

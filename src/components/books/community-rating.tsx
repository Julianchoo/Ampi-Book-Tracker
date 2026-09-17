import { Users } from "lucide-react";
import { hasCommunityRating } from "@/lib/shelf";
import { cn } from "@/lib/utils";

/*
 * Deliberately no star glyph and no --star gold: those mean "your rating".
 * This is an outside reference on a different (1–5) scale.
 */
export function CommunityRating({
  rating,
  count,
  className,
}: {
  rating: number | null;
  count: number | null;
  className?: string;
}) {
  if (rating == null || count == null) return null;
  if (!hasCommunityRating({ olRating: rating, olRatingCount: count })) return null;

  const value = rating.toFixed(1);
  // Always plural: hasCommunityRating requires at least MIN_COMMUNITY_RATINGS.
  const ratings = `${count.toLocaleString("en-GB")} ratings`;

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

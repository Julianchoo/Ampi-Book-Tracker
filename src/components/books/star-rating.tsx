"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { MAX_RATING, RATING_STEP } from "@/lib/books";
import { cn } from "@/lib/utils";

/*
 * 10 stars, each split into two half-width buttons, giving 1.0-10.0 in 0.5
 * steps. Hand-rolled rather than pulled in: the whole interaction is a
 * clip-path and a hover index.
 */

const SIZES = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-7",
} as const;

type Size = keyof typeof SIZES;

function Stars({
  value,
  size,
  className,
}: {
  value: number;
  size: Size;
  className?: string | undefined;
}) {
  return (
    <div className={cn("flex", className)} aria-hidden="true">
      {Array.from({ length: MAX_RATING }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i)); // 0, 0.5 or 1
        return (
          <span key={i} className="relative inline-flex">
            <Star className={cn(SIZES[size], "text-muted-foreground/30")} />
            {fill > 0 && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  className={cn(SIZES[size], "fill-star text-star")}
                />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** Read-only rating, for cards and lists. Renders nothing when unrated. */
export function StarRatingDisplay({
  value,
  size = "sm",
  showNumber = true,
  className,
}: {
  value: number | null | undefined;
  size?: Size;
  showNumber?: boolean;
  className?: string | undefined;
}) {
  if (value == null) return null;
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Stars value={value} size={size} />
      {showNumber && (
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {value.toFixed(1)}
        </span>
      )}
      <span className="sr-only">
        Rated {value} out of {MAX_RATING}
      </span>
    </div>
  );
}

/** Interactive rating input. */
export function StarRatingInput({
  value,
  onChange,
  size = "md",
  className,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  size?: Size;
  className?: string | undefined;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div
        className="relative inline-flex"
        onMouseLeave={() => setHover(null)}
        // Keyboard users get the slider below instead of 20 tab stops
        role="presentation"
      >
        <Stars value={shown} size={size} />
        <div className="absolute inset-0 flex">
          {Array.from({ length: MAX_RATING * 2 }, (_, i) => {
            const step = (i + 1) * RATING_STEP;
            return (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className="h-full flex-1 cursor-pointer"
                onMouseEnter={() => setHover(step)}
                // Clicking the current value clears it — the only way back to unrated
                onClick={() => onChange(value === step ? null : step)}
              />
            );
          })}
        </div>
      </div>

      {/* The accessible control. Arrow keys move in half stars. */}
      <input
        type="range"
        min={0}
        max={MAX_RATING}
        step={RATING_STEP}
        value={value ?? 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(n === 0 ? null : n);
        }}
        aria-label={`Rating out of ${MAX_RATING}`}
        className="sr-only"
      />

      <span className="text-sm font-medium tabular-nums text-muted-foreground">
        {value != null ? `${value.toFixed(1)} / ${MAX_RATING}` : "Not rated"}
      </span>

      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}

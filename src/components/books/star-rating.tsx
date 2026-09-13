"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { MAX_RATING, RATING_STEP } from "@/lib/books";
import { cn } from "@/lib/utils";

/*
 * Ratings run 1.0-10.0 in half-star steps.
 *
 * Input is drag-based rather than a grid of tiny tap targets: on a phone a
 * half star is about 9px wide, which is far below a usable touch target. The
 * whole strip is one pointer surface instead — press anywhere and slide, and
 * the value follows the finger until release. Pointer capture keeps it
 * tracking even when the finger wanders off the strip, and `touch-action:
 * none` stops the page scrolling underneath the gesture.
 */

const SIZES = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-8",
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
                <Star className={cn(SIZES[size], "fill-star text-star")} />
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

/** Snap a position along the strip (0-1) to the nearest half star. */
function ratioToRating(ratio: number): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  const stepped = Math.round((clamped * MAX_RATING) / RATING_STEP) * RATING_STEP;
  // Dragging to the very start means the lowest rating, not "unrated" —
  // clearing is an explicit action.
  return Math.min(MAX_RATING, Math.max(RATING_STEP, stepped));
}

export function StarRatingInput({
  value,
  onChange,
  size = "lg",
  className,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  size?: Size;
  className?: string | undefined;
}) {
  const stripRef = React.useRef<HTMLDivElement>(null);
  const [draft, setDraft] = React.useState<number | null>(null);

  // While dragging show the draft; otherwise the committed value.
  const shown = draft ?? value ?? 0;

  const readPointer = React.useCallback((clientX: number) => {
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return ratioToRating((clientX - rect.left) / rect.width);
  }, []);

  function handleDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const next = readPointer(e.clientX);
    if (next !== null) setDraft(next);
  }

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    // Only track once a press is in progress.
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const next = readPointer(e.clientX);
    if (next !== null) setDraft(next);
  }

  function handleUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (draft !== null) onChange(draft);
    setDraft(null);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-3">
        <div
          ref={stripRef}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
          // Generous vertical padding so the strip is a comfortable target,
          // and no touch-action so a horizontal drag never scrolls the page.
          className="-my-1 cursor-pointer touch-none py-1 select-none"
          role="presentation"
        >
          <Stars value={shown} size={size} />
        </div>

        {/* Live read-out: during a drag this tracks the finger. */}
        <span
          className={cn(
            "min-w-[4.5rem] text-lg font-semibold tabular-nums transition-colors",
            draft !== null ? "text-star" : "text-muted-foreground"
          )}
          aria-live="polite"
        >
          {shown > 0 ? (
            <>
              {shown.toFixed(1)}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {MAX_RATING}
              </span>
            </>
          ) : (
            <span className="text-sm font-normal text-muted-foreground">
              Not rated
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3">
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
        <p className="text-xs text-muted-foreground">
          Press and slide to rate
        </p>
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
    </div>
  );
}

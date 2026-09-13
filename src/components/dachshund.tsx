import { cn } from "@/lib/utils";

/*
 * Mascot icons.
 *
 * The dog is `dog-side` from Material Design Icons (Apache License 2.0,
 * https://pictogrammers.com/library/mdi/icon/dog-side/) rather than a drawing
 * of our own — it is a real, maintained icon, and being monochrome it takes
 * the theme colour through `currentColor` like every Lucide icon beside it.
 */

type IconProps = {
  className?: string | undefined;
  /** Decorative by default; pass a title to expose it to screen readers. */
  title?: string | undefined;
};

const DOG_PATH =
  "m19 3l-4 4l3 3l1-1l1 1l2-2l-3-3zM3 7L2 8l3 3v3l-1 1v6h2v-3l2-3h7v6h2V11l-3-3l-1 1H5z";

/** The mascot. Header logo, empty states, and anywhere the dog should appear. */
export function DachshundLogo({ className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" d={DOG_PATH} />
    </svg>
  );
}

/** Empty state: the dog beside a book. */
export function DachshundReading({ className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 44 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" d={DOG_PATH} />
      {/* open book, sitting on the same baseline as the dog's paws */}
      <g
        transform="translate(25 9)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      >
        <path d="M0 2.5c2.2-1.2 4.4-1.2 6.6 0c2.2-1.2 4.4-1.2 6.6 0v9c-2.2-1.2-4.4-1.2-6.6 0c-2.2-1.2-4.4-1.2-6.6 0z" />
        <path d="M6.6 2.5v9" />
      </g>
    </svg>
  );
}

/** Empty state / 404: the dog with sleep marks. */
export function DachshundSleeping({ className, title }: IconProps) {
  return (
    <svg
      viewBox="0 0 34 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-primary", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" d={DOG_PATH} />
      <g fill="currentColor" fontWeight="700" opacity="0.6">
        <text x="23" y="9" fontSize="6">
          z
        </text>
        <text x="28" y="5" fontSize="4.5">
          z
        </text>
      </g>
    </svg>
  );
}

/** Waddling in place. Loading states. */
export function DachshundLoading({
  className,
  label = "Loading",
}: {
  className?: string | undefined;
  label?: string | undefined;
}) {
  return (
    <div role="status" className="flex flex-col items-center gap-3">
      <DachshundLogo
        className={cn(
          "w-16 origin-bottom animate-waddle motion-reduce:animate-none",
          className
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Paw print. Bullets and small accents. Drawn here — Lucide's PawPrint is a
 *  multi-path icon we only need as a solid glyph. */
export function PawPrint({ className }: { className?: string | undefined }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="6.5" cy="9" rx="2.6" ry="3.4" />
      <ellipse cx="12" cy="6.6" rx="2.7" ry="3.6" />
      <ellipse cx="17.5" cy="9" rx="2.6" ry="3.4" />
      <path d="M12 12c3.4 0 6 2.4 6 5 0 2-1.7 3.2-3.6 2.7-1.6-.5-3.2-.5-4.8 0C7.7 20.2 6 19 6 17c0-2.6 2.6-5 6-5Z" />
    </svg>
  );
}

/**
 * Reading-progress bar: the dog trots along as you get further through a book.
 * `value` is 0-100.
 */
export function ReadingProgress({
  value,
  className,
}: {
  value: number;
  className?: string | undefined;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <DachshundLogo className="w-6 shrink-0 text-primary" />
    </div>
  );
}

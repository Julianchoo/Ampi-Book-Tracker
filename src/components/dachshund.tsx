import { cn } from "@/lib/utils";

/*
 * Mascot marks, all drawn from public/dachshund.png.
 *
 * The artwork is a solid black silhouette, which would disappear against the
 * dark theme if it were dropped in as an <img>. It is used as a CSS mask
 * instead and painted with `currentColor`, so it inherits `text-primary`,
 * opacity utilities and dark-mode colours exactly like an inline SVG would —
 * and the source PNG stays untouched.
 *
 * The mask uses a copy trimmed to the artwork's bounding box
 * (public/dachshund-logo.png, 188x86), so the mark fills its box instead of
 * floating in the original file's vertical padding.
 */

const MARK_ASPECT = "188 / 86";

const maskStyle: React.CSSProperties = {
  aspectRatio: MARK_ASPECT,
  backgroundColor: "currentColor",
  WebkitMaskImage: "url(/dachshund-logo.png)",
  maskImage: "url(/dachshund-logo.png)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskSize: "contain",
  maskSize: "contain",
};

type MarkProps = {
  className?: string | undefined;
  /** Decorative by default; pass a title to expose it to screen readers. */
  title?: string | undefined;
};

/**
 * The dachshund. Sized by width — height follows from the aspect ratio, so
 * callers set `w-*` and nothing else.
 */
export function DachshundLogo({ className, title }: MarkProps) {
  return (
    <span
      style={maskStyle}
      className={cn("inline-block shrink-0 text-primary", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    />
  );
}

// The empty states and 404 use the same mark; kept as named exports so call
// sites read as what they mean rather than all saying "logo".
export const DachshundReading = DachshundLogo;
export const DachshundSleeping = DachshundLogo;

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
          "w-24 origin-bottom animate-waddle motion-reduce:animate-none",
          className
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Small accent mark, e.g. section bullets. Same dog, small. */
export function PawPrint({ className }: { className?: string | undefined }) {
  return <DachshundLogo className={cn("w-4", className)} />;
}

/**
 * Reading-progress bar: the dachshund trots along as you get further through
 * a book. `value` is 0-100.
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
      <DachshundLogo className="w-9" />
    </div>
  );
}

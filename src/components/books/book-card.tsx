import Link from "next/link";
import { BookOpen } from "lucide-react";
import { BookCoverImage } from "@/components/books/book-cover-image";
import { CommunityRating } from "@/components/books/community-rating";
import { StarRatingDisplay } from "@/components/books/star-rating";
import { Badge } from "@/components/ui/badge";
import { coverUrls, formatDate, STATUS_LABELS, type Status } from "@/lib/books";
import type { Book } from "@/lib/queries";
import { formatDays, readingDays } from "@/lib/shelf";
import { cn } from "@/lib/utils";

/*
 * These sit on top of arbitrary book covers, so the background has to be
 * near-opaque — a translucent tint disappears entirely against a dark cover.
 * Colour carries the status, the solid plate carries the legibility.
 */
const STATUS_STYLES: Record<Status, string> = {
  reading: "bg-background/95 text-foreground border-star",
  finished: "bg-background/95 text-primary border-primary/40",
  abandoned: "bg-background/95 text-muted-foreground border-border",
};

export function BookCard({
  book,
  action,
  variant = "grid",
  showCommunityRating,
}: {
  book: Book;
  /** Optional footer control, e.g. wishlist's "Start reading". */
  action?: React.ReactNode;
  /** "wall" is the dense cover-only view: no text, no badge. */
  variant?: "grid" | "wall";
  showCommunityRating?: boolean;
}) {
  const cover = coverUrls(book.olKey, book.coverId, "M");
  const status = book.status as Status | null;
  const wall = variant === "wall";

  const coverLink = (
    <Link
      href={`/books/${book.id}`}
      // The wall has no visible text, so the link has to name the book itself.
      aria-label={
        wall
          ? `${book.title}${book.author ? ` by ${book.author}` : ""}${status ? `, ${STATUS_LABELS[status].toLowerCase()}` : ""}`
          : undefined
      }
      title={wall ? book.title : undefined}
      className="focus-visible:ring-ring/50 block rounded-lg focus-visible:ring-[3px] focus-visible:outline-none"
    >
      <div className="card-interactive relative aspect-2/3 w-full overflow-hidden rounded-lg border bg-muted shadow-sm group-hover:shadow-md">
        <BookCoverImage
          src={cover}
          alt=""
          fill
          sizes={
            wall
              ? "(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 160px"
              : // 2 cols on phones, up to 4 on desktop — keeps mobile payload small
                "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
          }
          className="object-cover"
          fallback={
            // The title is the only way to tell coverless books apart on the wall.
            <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
              <BookOpen className="size-7 text-muted-foreground/50" />
              <span className="line-clamp-3 text-xs text-muted-foreground">
                {book.title}
              </span>
            </div>
          }
        />

        {!wall && status && (
          <Badge
            variant="outline"
            className={cn(
              "absolute top-1.5 left-1.5 backdrop-blur-sm",
              STATUS_STYLES[status]
            )}
          >
            {STATUS_LABELS[status]}
          </Badge>
        )}
      </div>
    </Link>
  );

  if (wall) return <div className="group">{coverLink}</div>;

  const finished = formatDate(book.finishedAt);
  const days =
    status === "finished" ? readingDays(book.startedAt, book.finishedAt) : null;
  const meta = [
    book.pages ? `${book.pages.toLocaleString("en-GB")} pages` : null,
    days !== null ? formatDays(days) : null,
  ].filter(Boolean);

  return (
    <div className="group flex h-full flex-col">
      {coverLink}

      <div className="mt-2 flex flex-1 flex-col gap-1">
        <Link href={`/books/${book.id}`} className="hover:underline">
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold">
            {book.title}
          </h3>
        </Link>
        {book.author && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {book.author}
          </p>
        )}
        <StarRatingDisplay value={book.rating} />
        {finished && (
          <p className="text-xs text-muted-foreground">Finished {finished}</p>
        )}
        {meta.length > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {meta.join(" · ")}
          </p>
        )}
        {showCommunityRating && (
          <CommunityRating rating={book.olRating} count={book.olRatingCount} />
        )}
        {/* mt-auto pins actions to the bottom so a row's buttons line up. */}
        {action && <div className="mt-auto pt-2">{action}</div>}
      </div>
    </div>
  );
}

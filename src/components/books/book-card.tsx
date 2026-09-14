import Link from "next/link";
import { BookOpen } from "lucide-react";
import { BookCoverImage } from "@/components/books/book-cover-image";
import { StarRatingDisplay } from "@/components/books/star-rating";
import { Badge } from "@/components/ui/badge";
import { coverUrls, formatDate, STATUS_LABELS, type Status } from "@/lib/books";
import type { Book } from "@/lib/queries";
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
}: {
  book: Book;
  /** Optional footer control, e.g. wishlist's "Start reading". */
  action?: React.ReactNode;
}) {
  const cover = coverUrls(book.olKey, book.coverId, "M");
  const status = book.status as Status | null;
  const finished = formatDate(book.finishedAt);

  return (
    <div className="group flex flex-col">
      <Link
        href={`/books/${book.id}`}
        className="focus-visible:ring-ring/50 block rounded-lg focus-visible:ring-[3px] focus-visible:outline-none"
      >
        <div className="card-interactive relative aspect-2/3 w-full overflow-hidden rounded-lg border bg-muted shadow-sm group-hover:shadow-md">
          <BookCoverImage
            src={cover}
            alt=""
            fill
            // 2 cols on phones, up to 4 on desktop — keeps mobile payload small
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
            className="object-cover"
            fallback={
              <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                <BookOpen className="size-7 text-muted-foreground/50" />
                <span className="line-clamp-3 text-xs text-muted-foreground">
                  {book.title}
                </span>
              </div>
            }
          />

          {status && (
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
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

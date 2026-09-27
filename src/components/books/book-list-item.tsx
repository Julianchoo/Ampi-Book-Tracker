import Link from "next/link";
import { BookOpen } from "lucide-react";
import { BookCoverImage } from "@/components/books/book-cover-image";
import { StarRatingDisplay } from "@/components/books/star-rating";
import { Badge } from "@/components/ui/badge";
import { coverUrls, STATUS_LABELS, type Status } from "@/lib/books";
import type { Book } from "@/lib/queries";
import { cn } from "@/lib/utils";

/*
 * Finished is the norm in a library, so only the exceptions get a badge.
 * These sit on the page background, not a cover, so no solid plate is needed.
 */
const STATUS_STYLES: Partial<Record<Status, string>> = {
  reading: "border-star text-foreground",
  abandoned: "text-muted-foreground",
};

/** One row of the library's list view: the book and what you made of it. */
export function BookListItem({ book }: { book: Book }) {
  const href = `/books/${book.id}`;
  const cover = coverUrls(book.olKey, book.coverId, "M");
  const status = book.status as Status | null;
  const badgeStyle = status ? STATUS_STYLES[status] : undefined;
  const notes = book.notes?.trim();

  return (
    <div className="group flex gap-3 sm:gap-4">
      <Link
        href={href}
        // The title link is the named link; the cover is a duplicate.
        aria-hidden
        tabIndex={-1}
        className="focus-visible:ring-ring/50 block shrink-0 self-start rounded-md focus-visible:ring-[3px] focus-visible:outline-none"
      >
        <div className="card-interactive relative aspect-2/3 w-16 overflow-hidden rounded-md border bg-muted shadow-sm group-hover:shadow-md sm:w-20">
          <BookCoverImage
            src={cover}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
            fallback={
              <div className="flex h-full items-center justify-center">
                <BookOpen className="size-5 text-muted-foreground/50" />
              </div>
            }
          />
        </div>
      </Link>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="min-w-0 hover:underline">
            <h3 className="line-clamp-2 font-display text-base leading-snug font-semibold">
              {book.title}
              {status && <span className="sr-only">, {STATUS_LABELS[status].toLowerCase()}</span>}
            </h3>
          </Link>
          {status && badgeStyle && (
            // The sr-only suffix on the title already announces the status.
            <Badge variant="outline" aria-hidden className={cn("shrink-0", badgeStyle)}>
              {STATUS_LABELS[status]}
            </Badge>
          )}
        </div>
        {book.author && (
          <p className="line-clamp-1 text-sm text-muted-foreground">{book.author}</p>
        )}
        <StarRatingDisplay value={book.rating} className="pt-0.5" />
        {notes && (
          // pre-line keeps the paragraphs people typed without honouring stray indentation.
          <p className="line-clamp-3 pt-1 text-sm leading-6 break-words whitespace-pre-line text-foreground/85">
            {notes}
          </p>
        )}
      </div>
    </div>
  );
}

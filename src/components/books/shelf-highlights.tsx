import Link from "next/link";
import { BookOpen } from "lucide-react";
import { BookCoverImage } from "@/components/books/book-cover-image";
import { coverUrls } from "@/lib/books";
import type { Book } from "@/lib/queries";
import type { Highlights } from "@/lib/shelf";

export function ShelfHighlights<T extends Book>({
  highlights,
}: {
  highlights: Highlights<T>;
}) {
  const headingId = "shelf-highlights-heading";

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="font-display text-lg font-semibold">
        {highlights.title}
      </h2>
      {/* Swipeable row on phones, three columns once there is room. */}
      <ul className="mt-3 flex snap-x gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
        {highlights.items.map(({ label, value, book }) => (
          <li key={label} className="w-64 shrink-0 snap-start sm:w-auto">
            <Link
              href={`/books/${book.id}`}
              className="card-interactive focus-visible:ring-ring/50 flex h-full items-center gap-3 rounded-lg border bg-card p-3 shadow-sm focus-visible:ring-[3px] focus-visible:outline-none"
            >
              <div className="relative aspect-2/3 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                <BookCoverImage
                  // "M", not "S": same URL the shelf cards already cached, and sharp at 2x.
                  src={coverUrls(book.olKey, book.coverId, "M")}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                  fallback={
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="size-4 text-muted-foreground/50" />
                    </div>
                  }
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="line-clamp-2 text-sm font-semibold">{book.title}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{value}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

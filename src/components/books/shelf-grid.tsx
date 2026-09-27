import { BookCard } from "@/components/books/book-card";
import { BookListItem } from "@/components/books/book-list-item";
import type { View } from "@/lib/books";
import type { Book } from "@/lib/queries";
import type { ShelfSection } from "@/lib/shelf";
import { cn } from "@/lib/utils";

const GRID_CLASSES: Record<View, string> = {
  grid: "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4",
  wall: "grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7",
  // Rows carry notes, so a readable measure beats using the full width.
  list: "max-w-3xl divide-y [&>li]:py-4 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0",
};

type ShelfGridProps<T extends Book> = {
  /** Used when sections is null. */
  books: T[];
  /** null renders one flat grid. */
  sections: ShelfSection<T>[] | null;
  view: View;
  showCommunityRating?: boolean;
  /** Server-rendered footer per card, e.g. wishlist's StartReadingButton. */
  renderAction?: (book: T) => React.ReactNode;
};

export function ShelfGrid<T extends Book>({
  books,
  sections,
  view,
  showCommunityRating,
  renderAction,
}: ShelfGridProps<T>) {
  const grid = (list: T[], className?: string) => (
    <ul className={cn(GRID_CLASSES[view], className)}>
      {list.map((b) => (
        <li key={b.id}>
          {view === "list" ? (
            <BookListItem book={b} />
          ) : view === "wall" ? (
            <BookCard book={b} variant="wall" />
          ) : (
            <BookCard
              book={b}
              action={renderAction?.(b)}
              showCommunityRating={showCommunityRating ?? false}
            />
          )}
        </li>
      ))}
    </ul>
  );

  if (!sections) return grid(books);

  return (
    <div className="space-y-8">
      {sections.map((s) => {
        if (s.title === null) return <div key={s.key}>{grid(s.books)}</div>;
        const headingId = `shelf-section-${s.key}`;
        return (
          <section key={s.key} aria-labelledby={headingId}>
            <h2 id={headingId} className="font-display text-xl font-semibold">
              {s.title}
            </h2>
            {s.summary && (
              <p className="text-xs text-muted-foreground tabular-nums">{s.summary}</p>
            )}
            {grid(s.books, "mt-3")}
          </section>
        );
      })}
    </div>
  );
}

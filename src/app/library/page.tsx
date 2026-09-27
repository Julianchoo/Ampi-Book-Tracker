import Link from "next/link";
import { BookSearch } from "@/components/books/book-search";
import { ShelfGrid } from "@/components/books/shelf-grid";
import { ShelfHighlights } from "@/components/books/shelf-highlights";
import { ShelfToolbar } from "@/components/books/shelf-toolbar";
import { ViewToggle } from "@/components/books/view-toggle";
import { DachshundReading } from "@/components/dachshund";
import { Button } from "@/components/ui/button";
import { SHELF_VIEWS } from "@/lib/books";
import { getShelfView } from "@/lib/queries";
import { requireAuth } from "@/lib/session";
import {
  clearFiltersHref,
  filterBooks,
  groupByMonth,
  groupByYear,
  hasActiveFilters,
  libraryHighlights,
  parseShelfParams,
  shouldGroup,
  statusCounts,
  topSubjects,
} from "@/lib/shelf";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth();
  const filters = parseShelfParams(await searchParams, "library");
  const { books, collections } = await getShelfView(
    session.user.id,
    "library",
    filters.sort
  );

  const visible = filterBooks(books, filters);
  // Chip counts respect every filter except status itself, so each chip says
  // what clicking it would show.
  const counts = statusCounts(filterBooks(books, filters, { ignoreStatus: true }));
  const subjects = topSubjects(books);
  const highlights = hasActiveFilters(filters)
    ? null
    : libraryHighlights(books, new Date().getFullYear());
  // List rows are tall, so a year is a long scroll there; months keep sections short.
  const groupBy = filters.view === "list" ? groupByMonth : groupByYear;
  const sections = shouldGroup("library", filters) ? groupBy(visible) : null;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you&rsquo;ve started, finished, or set aside.
          </p>
        </div>
        {books.length > 0 && <ViewToggle view={filters.view} views={SHELF_VIEWS.library} />}
      </header>

      <BookSearch className="mb-5" />

      {highlights && (
        <div className="mb-6">
          <ShelfHighlights highlights={highlights} />
        </div>
      )}

      {books.length > 0 && (
        <ShelfToolbar
          shelf="library"
          filters={filters}
          counts={counts}
          subjects={subjects}
          collections={collections}
          count={visible.length}
        />
      )}

      {books.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <DachshundReading className="w-44 text-primary/45" />
          <p className="mt-4 font-display text-lg font-semibold">
            Your shelf is empty
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Search above for a book you&rsquo;re reading and add it to your library.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <DachshundReading className="w-44 text-primary/45" />
          <p className="mt-4 font-display text-lg font-semibold">
            Nothing matches these filters
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={clearFiltersHref("library", filters)}>Clear filters</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5">
          <ShelfGrid books={visible} sections={sections} view={filters.view} />
        </div>
      )}
    </div>
  );
}

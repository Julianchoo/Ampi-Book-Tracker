import Link from "next/link";
import { after } from "next/server";
import { BookSearch } from "@/components/books/book-search";
import { ShelfGrid } from "@/components/books/shelf-grid";
import { ShelfHighlights } from "@/components/books/shelf-highlights";
import { ShelfToolbar } from "@/components/books/shelf-toolbar";
import { StartReadingButton } from "@/components/books/start-reading-button";
import { ViewToggle } from "@/components/books/view-toggle";
import { DachshundReading, DachshundSleeping } from "@/components/dachshund";
import { Button } from "@/components/ui/button";
import { SHELF_VIEWS } from "@/lib/books";
import { getShelfView } from "@/lib/queries";
import { refreshRatings } from "@/lib/ratings";
import { requireAuth } from "@/lib/session";
import {
  clearFiltersHref,
  filterBooks,
  hasActiveFilters,
  parseShelfParams,
  pickStaleForRating,
  topSubjects,
  wishlistHighlights,
} from "@/lib/shelf";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth();
  const filters = parseShelfParams(await searchParams, "wishlist");
  const { books, collections } = await getShelfView(
    session.user.id,
    "wishlist",
    filters.sort
  );

  const visible = filterBooks(books, filters);
  const subjects = topSubjects(books);
  const highlights = hasActiveFilters(filters) ? null : wishlistHighlights(books);

  // Open Library is slow and rate-limited, so ratings are never fetched during
  // render: stale ones refresh after the response and show on the next visit.
  // Values are captured up front — request APIs aren't available inside after().
  const stale = pickStaleForRating(books);
  if (stale.length) {
    const userId = session.user.id;
    const targets = stale.map(({ id, title, author }) => ({ id, title, author }));
    // ponytail: overlapping re-renders can schedule concurrent refresh jobs that
    // briefly exceed Open Library's 1 req/s; bounded by the ≤5 cap and
    // stop-on-failure. Add a per-user in-flight guard if it becomes a problem.
    after(() => refreshRatings(userId, targets));
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Wishlist
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Books to get to. Start one and it moves to your library.
          </p>
        </div>
        {books.length > 0 && <ViewToggle view={filters.view} views={SHELF_VIEWS.wishlist} />}
      </header>

      <BookSearch className="mb-5" />

      {highlights && (
        <div className="mb-6">
          <ShelfHighlights highlights={highlights} />
        </div>
      )}

      {/* No status chips here — wishlist books have no reading status yet */}
      {books.length > 0 && (
        <ShelfToolbar
          shelf="wishlist"
          filters={filters}
          counts={null}
          subjects={subjects}
          collections={collections}
          count={visible.length}
        />
      )}

      {books.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <DachshundSleeping className="w-48 text-primary/45" />
          <p className="mt-4 font-display text-lg font-semibold">
            Nothing on the wishlist
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Search above and tuck a few books away for later.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <DachshundReading className="w-44 text-primary/45" />
          <p className="mt-4 font-display text-lg font-semibold">
            Nothing matches these filters
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href={clearFiltersHref("wishlist", filters)}>Clear filters</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5">
          <ShelfGrid
            books={visible}
            sections={null}
            view={filters.view}
            showCommunityRating
            renderAction={(b) => <StartReadingButton id={b.id} title={b.title} />}
          />
        </div>
      )}
    </div>
  );
}

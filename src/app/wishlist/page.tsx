import { BookCard } from "@/components/books/book-card";
import { BookSearch } from "@/components/books/book-search";
import { ShelfToolbar } from "@/components/books/shelf-toolbar";
import { StartReadingButton } from "@/components/books/start-reading-button";
import { DachshundSleeping } from "@/components/dachshund";
import { isSortKey } from "@/lib/books";
import { getShelf } from "@/lib/queries";
import { requireAuth } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  const sort = isSortKey(params.sort) ? params.sort : "added";

  const books = await getShelf(session.user.id, "wishlist", { sort });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Wishlist
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Books to get to. Start one and it moves to your library.
        </p>
      </header>

      <BookSearch className="mb-5" />

      {/* No status filter here — wishlist books have no reading status yet */}
      <ShelfToolbar
        sort={sort}
        status={undefined}
        showStatusFilter={false}
        count={books.length}
      />

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
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((b) => (
            <li key={b.id}>
              <BookCard
                book={b}
                action={<StartReadingButton id={b.id} title={b.title} />}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { BookCard } from "@/components/books/book-card";
import { BookSearch } from "@/components/books/book-search";
import { ShelfToolbar } from "@/components/books/shelf-toolbar";
import { DachshundReading } from "@/components/dachshund";
import { isSortKey, STATUSES, type Status } from "@/lib/books";
import { getShelf } from "@/lib/queries";
import { requireAuth } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; status?: string }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;

  const sort = isSortKey(params.sort) ? params.sort : "recent";
  const status = STATUSES.includes(params.status as Status)
    ? (params.status as Status)
    : undefined;

  const books = await getShelf(session.user.id, "library", { sort, status });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Library
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you&rsquo;ve started, finished, or set aside.
        </p>
      </header>

      <BookSearch className="mb-5" />

      <ShelfToolbar sort={sort} status={status} count={books.length} />

      {books.length === 0 ? (
        <EmptyLibrary filtered={!!status} />
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((b) => (
            <li key={b.id}>
              <BookCard book={b} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyLibrary({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <DachshundReading className="w-44 text-primary/45" />
      <p className="mt-4 font-display text-lg font-semibold">
        {filtered ? "Nothing on this shelf" : "Your shelf is empty"}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {filtered
          ? "Try a different status filter."
          : "Search above for a book you're reading and add it to your library."}
      </p>
    </div>
  );
}

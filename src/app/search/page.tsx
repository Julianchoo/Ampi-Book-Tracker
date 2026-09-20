import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { SearchResultCard } from "@/components/books/search-result-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchBooksForUser } from "@/lib/booksearch";
import { requireAuth } from "@/lib/session";
import type { Metadata } from "next";

const RESULTS_LIMIT = 24;

type SearchParams = Promise<{ q?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `“${q}” — Search` : "Search" };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAuth();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const results =
    query.length >= 2
      ? await searchBooksForUser(session.user.id, query, RESULTS_LIMIT)
      : [];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Search
      </h1>

      <form action="/search" method="GET" className="relative mt-5">
        <SearchIcon
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search any book or author…"
          aria-label="Search for a book by title or author"
          className="h-12 pl-9 text-base"
        />
      </form>

      <div className="mt-6">
        {query.length < 2 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Type at least two characters to search.
          </p>
        ) : results.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <p>No books found for “{query}”.</p>
            <Button asChild variant="link" className="mt-1">
              <Link href="/search">Try another search</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {results.length} result{results.length === 1 ? "" : "s"} for “{query}”
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {results.map((hit) => (
                <SearchResultCard key={hit.olKey} hit={hit} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Heart, Library, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { BookCoverImage } from "@/components/books/book-cover-image";
import { useAddBook } from "@/components/books/use-add-book";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { coverUrls, previewHref, type SearchHit, type Shelf } from "@/lib/books";
import { cn } from "@/lib/utils";

type Hit = SearchHit;

export function BookSearch({ className }: { className?: string | undefined }) {
  const router = useRouter();
  const { pending, add } = useAddBook();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Only the newest request is allowed to write state. Open Library responses
  // come back out of order often enough that a slow early one would otherwise
  // overwrite the results for what the user has since typed.
  const latestRequest = React.useRef(0);

  React.useEffect(() => {
    const q = query.trim();
    // Nothing to do, and nothing to reset: the dropdown is gated on the same
    // length check, so leaving the old hits in state avoids a flicker.
    if (q.length < 2) return;

    const id = ++latestRequest.current;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/books/search?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { results: Hit[] };
        if (id === latestRequest.current) {
          setHits(data.results);
          setOpen(true);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError" && id === latestRequest.current) {
          setHits([]);
          toast.error("Book search is unavailable right now.");
        }
      } finally {
        if (id === latestRequest.current) setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  async function addFromDropdown(hit: Hit, shelf: Shelf) {
    const id = await add(hit, shelf);
    if (id) {
      setOpen(false);
      setQuery("");
    }
  }

  function goToResultsPage() {
    const q = query.trim();
    if (q.length < 2) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search
          className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              goToResultsPage();
            }
          }}
          placeholder="Search any book or author…"
          aria-label="Search for a book by title or author"
          className="h-12 pl-9 text-base"
        />
        {loading && (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <Command
          // cmdk filters client-side by default, which fights async results
          shouldFilter={false}
          // h-auto is load-bearing: shadcn's Command root ships `h-full`, and on
          // an absolutely-positioned element that resolves against the input
          // wrapper, collapsing the panel to one sliver of a row.
          className="absolute z-50 mt-2 h-auto w-full overflow-hidden rounded-xl border-2 bg-popover shadow-2xl"
        >
          <CommandList className="max-h-[70vh] min-h-[8rem] overscroll-contain">
            {!loading && hits.length === 0 && (
              <CommandEmpty className="py-12 text-center text-sm text-muted-foreground">
                No books found for “{query.trim()}”.
              </CommandEmpty>
            )}
            {hits.length > 0 && (
              <CommandGroup>
                {hits.map((hit) => {
                  const cover = coverUrls(hit.olKey, hit.coverId, "S");
                  const busy = pending === hit.olKey;
                  return (
                    <CommandItem
                      key={hit.olKey}
                      value={hit.olKey}
                      // Selection is handled by the explicit link/buttons below
                      onSelect={() => {}}
                      className="flex flex-col gap-2 rounded-lg px-2 py-3"
                    >
                      <Link
                        href={previewHref(hit)}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3.5 rounded-md focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
                      >
                        <div className="relative h-[5.5rem] w-[3.75rem] shrink-0 overflow-hidden rounded-md border bg-muted shadow-sm">
                          <BookCoverImage
                            src={cover}
                            alt=""
                            fill
                            sizes="60px"
                            className="object-cover"
                            fallback={
                              <BookOpen className="absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/50" />
                            }
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[0.95rem] leading-snug font-semibold hover:underline">
                            {hit.title}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {[hit.author, hit.firstPublishYear]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>

                          {hit.onShelf && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              Already on your{" "}
                              {hit.onShelf === "library" ? "shelf" : "wishlist"}
                            </p>
                          )}
                        </div>
                      </Link>

                      {!hit.onShelf && (
                        <div className="ml-[calc(3.75rem+0.875rem)] flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="h-9 px-3 text-sm"
                            disabled={busy}
                            onClick={() => addFromDropdown(hit, "library")}
                          >
                            {busy ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Library className="size-4" />
                            )}
                            Library
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-9 px-3 text-sm"
                            disabled={busy}
                            onClick={() => addFromDropdown(hit, "wishlist")}
                          >
                            <Heart className="size-4" />
                            Wishlist
                          </Button>
                        </div>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {hits.length > 0 && (
              <div className="border-t p-1">
                <Button
                  variant="ghost"
                  className="h-9 w-full justify-center text-sm text-muted-foreground"
                  onClick={goToResultsPage}
                >
                  <Search className="size-4" />
                  See all results for “{query.trim()}”
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      )}
    </div>
  );
}

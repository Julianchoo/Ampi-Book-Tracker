"use client";

import Link from "next/link";
import { Heart, Library, Loader2 } from "lucide-react";
import { useAddBook } from "@/components/books/use-add-book";
import { Button } from "@/components/ui/button";
import type { BookSearchResult, Shelf } from "@/lib/books";

/**
 * The one thing a preview page can do that a search hit can't just be
 * clicked into: actually add it. Kept separate from the server component so
 * the rest of the page — cover, facts, streamed description — needs no
 * client JS at all.
 */
export function PreviewActions({
  hit,
  onShelf,
  bookId,
}: {
  hit: BookSearchResult;
  onShelf: Shelf | null;
  bookId: string | null;
}) {
  const { pending, add } = useAddBook();
  const busy = pending === hit.olKey;

  if (onShelf && bookId) {
    return (
      <Button asChild size="sm">
        <Link href={`/books/${bookId}`}>
          Already on your {onShelf === "library" ? "shelf" : "wishlist"} — view
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy} onClick={() => add(hit, "library")}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Library className="size-4" />
        )}
        Add to Library
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => add(hit, "wishlist")}
      >
        <Heart className="size-4" />
        Add to Wishlist
      </Button>
    </div>
  );
}

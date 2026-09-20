"use client";

import Link from "next/link";
import { BookOpen, Heart, Library, Loader2 } from "lucide-react";
import { BookCoverImage } from "@/components/books/book-cover-image";
import { useAddBook } from "@/components/books/use-add-book";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { coverUrls, previewHref, type SearchHit } from "@/lib/books";

/** One SERP result: a cover, the facts, and either "add" or "already yours". */
export function SearchResultCard({ hit }: { hit: SearchHit }) {
  const { pending, add } = useAddBook();
  const cover = coverUrls(hit.olKey, hit.coverId, "M");
  const busy = pending === hit.olKey;
  const href = previewHref(hit);

  return (
    <div className="flex gap-4 rounded-lg border bg-card p-4 shadow-sm card-interactive">
      <Link
        href={href}
        className="relative aspect-2/3 w-20 shrink-0 overflow-hidden rounded-md border bg-muted shadow-sm sm:w-24"
      >
        <BookCoverImage
          src={cover}
          alt=""
          fill
          sizes="96px"
          className="object-cover"
          fallback={
            <BookOpen className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/50" />
          }
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={href} className="hover:underline">
          <h3 className="line-clamp-2 text-base leading-snug font-semibold">
            {hit.title}
          </h3>
        </Link>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {[hit.author, hit.firstPublishYear].filter(Boolean).join(" · ")}
        </p>

        {hit.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
            {hit.description}
          </p>
        )}

        {hit.subjects.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hit.subjects.slice(0, 3).map((s) => (
              <Badge key={s} variant="outline" className="font-normal">
                {s}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3">
          {hit.onShelf ? (
            <Button asChild size="sm" variant="ghost" className="h-9 px-2.5 text-sm">
              <Link href={`/books/${hit.bookId}`}>
                Already on your {hit.onShelf === "library" ? "shelf" : "wishlist"} —
                view
              </Link>
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="h-9 px-3 text-sm"
                disabled={busy}
                onClick={() => add(hit, "library")}
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
                onClick={() => add(hit, "wishlist")}
              >
                <Heart className="size-4" />
                Wishlist
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

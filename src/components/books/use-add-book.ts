import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addBook } from "@/lib/actions/books";
import type { BookSearchResult, Shelf } from "@/lib/books";

/**
 * Shared "add a search hit to a shelf" flow — the typeahead dropdown, the
 * search results page and a book's preview page all offer the same two
 * buttons and need the same pending state, toast and refresh behaviour.
 */
export function useAddBook() {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function add(hit: BookSearchResult, shelf: Shelf) {
    setPending(hit.olKey);
    const result = await addBook({
      olKey: hit.olKey,
      source: hit.source,
      // Google returns the blurb inline; storing it now means the book page
      // opens with no network call of its own.
      description: hit.description,
      title: hit.title,
      author: hit.author,
      coverId: hit.coverId,
      firstPublishYear: hit.firstPublishYear,
      pages: hit.pages,
      language: hit.language,
      subjects: hit.subjects,
      shelf,
    });
    setPending(null);

    if (!result.ok) {
      toast.error(result.error);
      return null;
    }

    // Refresh in place rather than navigating: the shelf the user is looking
    // at updates immediately, and they avoid a page load that waits on Open
    // Library. Opening the book to add a rating is offered, not forced.
    router.refresh();
    toast.success(
      shelf === "library"
        ? `“${hit.title}” added to your library`
        : `“${hit.title}” added to your wishlist`,
      {
        action: {
          label: "Add details",
          onClick: () => router.push(`/books/${result.id}?welcome=1`),
        },
      }
    );
    return result.id;
  }

  return { pending, add };
}

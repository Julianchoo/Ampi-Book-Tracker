import { notFound } from "next/navigation";
import { BookOpen, ExternalLink } from "lucide-react";
import { BackButton } from "@/components/books/back-button";
import { BookCoverImage } from "@/components/books/book-cover-image";
import { BookDescription } from "@/components/books/book-description";
import { PreviewActions } from "@/components/books/preview-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  amazonUrl,
  coverUrls,
  languageName,
  slugToOlKey,
  sourceUrl,
  SOURCES,
  type BookSearchResult,
  type Source,
} from "@/lib/books";
import { getBookByOlKey } from "@/lib/queries";
import { requireAuth } from "@/lib/session";
import type { Metadata } from "next";

type Params = { params: Promise<{ slug: string[] }> };
type SearchParams = Promise<{
  source?: string;
  title?: string;
  author?: string;
  cover?: string;
  year?: string;
  pages?: string;
  lang?: string;
  subjects?: string;
}>;

/**
 * Rebuilds the search hit from its query params. Returns null when there's
 * no title — this page only exists reached from a search result, which
 * always carries one, and with none there's no reliable way to fetch one
 * back (neither provider exposes a plain "fetch by key" call).
 */
function readHit(sp: Awaited<SearchParams>, olKey: string): BookSearchResult | null {
  const title = sp.title?.trim();
  if (!title) return null;

  const source: Source = SOURCES.includes(sp.source as Source)
    ? (sp.source as Source)
    : "openlibrary";

  return {
    olKey,
    source,
    title,
    author: sp.author?.trim() || null,
    coverId: sp.cover ? Number(sp.cover) || null : null,
    firstPublishYear: sp.year ? Number(sp.year) || null : null,
    pages: sp.pages ? Number(sp.pages) || null : null,
    language: sp.lang?.trim() || null,
    subjects: sp.subjects ? sp.subjects.split("|").filter(Boolean) : [],
    description: null,
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  return { title: sp.title?.trim() || "Book" };
}

/**
 * Preview of a search hit that isn't on a shelf yet — everything a book's own
 * page shows except a rating, dates or notes, since those only make sense
 * once it's actually shelved. Reached by clicking a title in the search
 * dropdown or on the search results page; never navigated to by adding.
 */
export default async function BookPreviewPage({ params, searchParams }: Params & { searchParams: SearchParams }) {
  const session = await requireAuth();
  const { slug } = await params;
  const sp = await searchParams;
  const olKey = slugToOlKey(slug);
  const hit = readHit(sp, olKey);
  if (!hit) notFound();

  const existing = await getBookByOlKey(session.user.id, olKey);

  const cover = coverUrls(olKey, hit.coverId, "L");
  const source = sourceUrl(olKey);
  const facts = [
    hit.firstPublishYear && { label: "First published", value: String(hit.firstPublishYear) },
    hit.pages && { label: "Pages", value: String(hit.pages) },
    hit.language && { label: "Language", value: languageName(hit.language)! },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-5 sm:py-8">
      <BackButton />

      <section className="flex flex-col gap-5 sm:flex-row sm:gap-7">
        <div className="relative mx-auto aspect-2/3 w-40 shrink-0 overflow-hidden rounded-lg border bg-muted shadow-md sm:mx-0 sm:w-52">
          <BookCoverImage
            src={cover}
            alt={`Cover of ${hit.title}`}
            fill
            sizes="(max-width: 640px) 160px, 208px"
            className="object-cover"
            priority
            fallback={
              <BookOpen className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/40" />
            }
          />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
            {hit.title}
          </h1>
          {hit.author && (
            <p className="mt-1 text-base text-muted-foreground">{hit.author}</p>
          )}

          {facts.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="text-sm font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-4">
            <PreviewActions
              hit={hit}
              onShelf={existing?.shelf ?? null}
              bookId={existing?.id ?? null}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={amazonUrl(hit.title, hit.author)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                Find on Amazon
              </a>
            </Button>
            {source && (
              <Button asChild variant="ghost" size="sm">
                <a href={source.href} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                  {source.label}
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      {hit.subjects.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {hit.subjects.map((s) => (
            <Badge key={s} variant="outline" className="font-normal">
              {s}
            </Badge>
          ))}
        </div>
      )}

      <BookDescription olKey={olKey} initial={null} />
    </div>
  );
}

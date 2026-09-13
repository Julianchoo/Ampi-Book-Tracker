import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink, Heart, Library } from "lucide-react";
import { BookDetailsForm } from "@/components/books/book-details-form";
import { StarRatingDisplay } from "@/components/books/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  amazonUrl,
  coverUrl,
  formatDate,
  languageName,
  STATUS_LABELS,
  type Status,
} from "@/lib/books";
import { getWorkDetail, olId } from "@/lib/openlibrary";
import { getBook } from "@/lib/queries";
import { requireAuth } from "@/lib/session";
import type { Metadata } from "next";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const session = await requireAuth();
  const { id } = await params;
  const book = await getBook(session.user.id, id);
  return { title: book?.title ?? "Book" };
}

export default async function BookPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<{ welcome?: string }> }) {
  const session = await requireAuth();
  const { id } = await params;
  const { welcome } = await searchParams;

  // A malformed uuid would make Postgres throw rather than return no rows
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const book = await getBook(session.user.id, id);
  if (!book) notFound();

  // Live lookup for the long-form blurb. Never throws — a book page must
  // render even when Open Library is unreachable.
  const detail = await getWorkDetail(book.olKey);

  const cover = coverUrl(book.coverId, "L");
  const status = book.status as Status | null;
  const subjects = book.subjects?.length ? book.subjects : detail.subjects;

  const facts = [
    book.firstPublishYear && { label: "First published", value: String(book.firstPublishYear) },
    book.pages && { label: "Pages", value: String(book.pages) },
    book.language && { label: "Language", value: languageName(book.language)! },
    formatDate(book.startedAt) && { label: "Started", value: formatDate(book.startedAt)! },
    formatDate(book.finishedAt) && { label: "Finished", value: formatDate(book.finishedAt)! },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-5 sm:py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href={book.shelf === "wishlist" ? "/wishlist" : "/library"}>
          <ArrowLeft className="size-4" />
          Back to {book.shelf === "wishlist" ? "wishlist" : "library"}
        </Link>
      </Button>

      {/* Hero */}
      <section className="flex flex-col gap-5 sm:flex-row sm:gap-7">
        <div className="relative mx-auto aspect-2/3 w-40 shrink-0 overflow-hidden rounded-lg border bg-muted shadow-md sm:mx-0 sm:w-52">
          {cover ? (
            <Image
              src={cover}
              alt={`Cover of ${book.title}`}
              fill
              sizes="(max-width: 640px) 160px, 208px"
              className="object-cover"
              priority
            />
          ) : (
            <BookOpen className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/40" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {book.shelf === "wishlist" ? (
                <>
                  <Heart className="size-3" /> Wishlist
                </>
              ) : (
                <>
                  <Library className="size-3" /> Library
                </>
              )}
            </Badge>
            {status && <Badge variant="outline">{STATUS_LABELS[status]}</Badge>}
          </div>

          <h1 className="mt-2 font-display text-2xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
            {book.title}
          </h1>
          {book.author && (
            <p className="mt-1 text-base text-muted-foreground">{book.author}</p>
          )}

          {book.rating != null && (
            <StarRatingDisplay value={book.rating} size="md" className="mt-3" />
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

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a
                href={amazonUrl(book.title, book.author)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-4" />
                Find on Amazon
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a
                href={`https://openlibrary.org/works/${olId(book.olKey)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-4" />
                Open Library
              </a>
            </Button>
          </div>
        </div>
      </section>

      {subjects.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <Badge key={s} variant="outline" className="font-normal">
              {s}
            </Badge>
          ))}
        </div>
      )}

      {detail.description && (
        <section className="mt-6">
          <h2 className="font-display text-lg font-semibold">About this book</h2>
          {/* Open Library descriptions are plain text with hard line breaks */}
          <div className="mt-2 space-y-3 text-sm leading-7 text-muted-foreground">
            {detail.description
              .split(/\n{2,}/)
              .slice(0, 6)
              .map((para, i) => (
                <p key={i}>{para.replace(/\s*\n\s*/g, " ").trim()}</p>
              ))}
          </div>
        </section>
      )}

      <div className="mt-7">
        <BookDetailsForm book={book} highlight={welcome === "1"} />
      </div>
    </div>
  );
}

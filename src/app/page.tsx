import Link from "next/link";
import { ArrowRight, BookOpen, Heart, Library } from "lucide-react";
import { AuthDivider, GoogleButton } from "@/components/auth/google-button";
import { SignInButton } from "@/components/auth/sign-in-button";
import { BookCoverImage } from "@/components/books/book-cover-image";
import { BookSearch } from "@/components/books/book-search";
import { ReadingStatsCharts } from "@/components/books/reading-stats";
import { StarRatingDisplay } from "@/components/books/star-rating";
import { DachshundLogo, DachshundReading, PawPrint } from "@/components/dachshund";
import { Button } from "@/components/ui/button";
import { isGoogleEnabled } from "@/lib/auth";
import { coverUrl, formatDate } from "@/lib/books";
import { getCurrentlyReading, getStats, type Book } from "@/lib/queries";
import { getOptionalSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getOptionalSession();
  if (!session) return <Landing />;

  const [current, stats] = await Promise.all([
    getCurrentlyReading(session.user.id),
    getStats(session.user.id),
  ]);

  const firstName = session.user.name?.split(" ")[0];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {firstName ? `Hello, ${firstName}` : "Your shelf"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What are you reading today?
        </p>
      </header>

      <BookSearch className="mb-6" />

      {current ? <CurrentBook book={current} /> : <NothingOpen />}

      <div className="my-6 grid grid-cols-2 gap-3">
        <Button asChild size="lg" className="h-12">
          <Link href="/library">
            <Library className="size-4" />
            Library
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary" className="h-12">
          <Link href="/wishlist">
            <Heart className="size-4" />
            Wishlist
          </Link>
        </Button>
      </div>

      <ReadingStatsCharts stats={stats} />
    </div>
  );
}

/** The hero: the book you most recently picked up. */
function CurrentBook({ book }: { book: Book }) {
  const cover = coverUrl(book.olKey, book.coverId, "L");
  const started = formatDate(book.startedAt);

  return (
    <section
      aria-labelledby="current-heading"
      className="animate-fade-up overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="flex items-center gap-2 border-b bg-accent/40 px-4 py-2">
        <PawPrint className="w-5 text-primary/60" />
        <h2
          id="current-heading"
          className="text-xs font-semibold tracking-wide uppercase"
        >
          Currently reading
        </h2>
      </div>

      <Link
        href={`/books/${book.id}`}
        className="group flex gap-4 p-4 sm:gap-5 sm:p-5"
      >
        <div className="relative aspect-2/3 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted shadow-sm sm:w-32">
          <BookCoverImage
            src={cover}
            alt=""
            fill
            sizes="(max-width: 640px) 96px, 128px"
            className="object-cover"
            priority
            fallback={
              <BookOpen className="absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/40" />
            }
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3 className="font-display text-xl leading-tight font-bold text-balance group-hover:underline sm:text-2xl">
            {book.title}
          </h3>
          {book.author && (
            <p className="mt-0.5 text-sm text-muted-foreground">{book.author}</p>
          )}
          <StarRatingDisplay value={book.rating} className="mt-2" />
          {started && (
            <p className="mt-2 text-xs text-muted-foreground">
              Started {started}
            </p>
          )}
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Open book <ArrowRight className="size-4" />
          </span>
        </div>
      </Link>
    </section>
  );
}

function NothingOpen() {
  return (
    <section className="flex flex-col items-center rounded-xl border border-dashed py-10 text-center">
      <DachshundReading className="w-40 text-primary/40" />
      <p className="mt-3 font-display text-lg font-semibold">
        Nothing open right now
      </p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Search above for a book and add it to your library to start reading.
      </p>
    </section>
  );
}

/** Signed-out landing. */
function Landing() {
  return (
    <div className="auth-bg">
      <div className="container mx-auto flex max-w-2xl flex-col items-center px-4 py-14 text-center sm:py-20">
        <DachshundLogo className="w-40 text-primary sm:w-52" />
        <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Ampi&rsquo;s Book Tracker
        </h1>
        <p className="mt-3 max-w-md text-base text-muted-foreground text-pretty">
          A cosy little tracker for the books you read. Search any title, shelve
          it, rate it out of ten, and watch your reading year take shape.
        </p>

        <div className="mt-7 flex w-full max-w-sm flex-col items-center gap-4">
          {isGoogleEnabled && (
            <>
              <GoogleButton label="Continue with Google" />
              <AuthDivider />
            </>
          )}
          <SignInButton />
        </div>

        <ul className="mt-10 grid w-full gap-3 text-left sm:grid-cols-3">
          {[
            {
              icon: BookOpen,
              title: "Find any book",
              body: "Search millions of titles from Open Library as you type.",
            },
            {
              icon: Library,
              title: "Two shelves",
              body: "A library for what you've read, a wishlist for what's next.",
            },
            {
              icon: Heart,
              title: "Your ratings",
              body: "Half-star ratings out of ten, dates, and private notes.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-lg border bg-card p-4 shadow-sm">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-2 text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

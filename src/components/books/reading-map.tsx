"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  List,
  Map as MapIcon,
  Maximize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { BookCoverImage } from "@/components/books/book-cover-image";
import { CommunityRating } from "@/components/books/community-rating";
import {
  ReadingMapSvg,
  type MapSelection,
} from "@/components/books/reading-map-svg";
import { StarRatingDisplay } from "@/components/books/star-rating";
import { PawPrint } from "@/components/dachshund";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  BookNode,
  GenreNode,
  ReadingMap as ReadingMapData,
} from "@/lib/constellation";
import { cn } from "@/lib/utils";

const ZOOM_STEPS = [1, 1.5, 2.25, 3.4] as const;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Lookups every part of the dialog needs, built once per map. */
function useIndex(map: ReadingMapData) {
  return React.useMemo(() => {
    const genreById = new Map(map.genres.map((g) => [g.id, g]));
    const bookById = new Map(map.books.map((b) => [b.id, b]));
    const childrenOf = (id: string) => map.genres.filter((g) => g.parentId === id);
    /** Books of a genre and of its child genres, in map order. */
    const booksOf = (id: string) => {
      const ids = new Set([id, ...childrenOf(id).map((c) => c.id)]);
      return map.books.filter((b) => b.genreIds.some((g) => ids.has(g)));
    };
    return { genreById, bookById, childrenOf, booksOf };
  }, [map]);
}

type Index = ReturnType<typeof useIndex>;

/** A one-line announcement for the selection, e.g. "Thrillers, 7 books". */
function selectionStatus(selected: MapSelection | null, index: Index): string {
  if (!selected) return "";
  if (selected.kind === "genre") {
    const genre = index.genreById.get(selected.id);
    return genre ? `${genre.label}, ${plural(index.booksOf(genre.id).length, "book")}` : "";
  }
  const book = index.bookById.get(selected.id);
  if (!book) return "";
  return book.author ? `${book.title} by ${book.author}` : book.title;
}

/** The viewBox for a zoom level, centred on a point and kept inside the map. */
function zoomViewBox(
  map: ReadingMapData,
  k: number,
  cx: number,
  cy: number
): string {
  const w = map.width / k;
  const h = map.height / k;
  const x = Math.min(Math.max(cx - w / 2, 0), map.width - w);
  const y = Math.min(Math.max(cy - h / 2, 0), map.height - h);
  return `${x} ${y} ${w} ${h}`;
}

export function ReadingMap({ map }: { map: ReadingMapData }) {
  const summary = `${plural(map.books.length, "book")} across ${plural(map.genres.length, "genre")}`;

  return (
    <Dialog>
      <section aria-label="Your reading map">
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="Open your reading map"
            className="card-interactive group block w-full animate-fade-up overflow-hidden rounded-xl border bg-card text-left shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="flex items-center gap-2 border-b bg-accent/40 px-4 py-2">
              <PawPrint className="w-5 text-primary/60" />
              <span className="text-xs font-semibold tracking-wide uppercase">
                Your reading map
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                Explore
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
            <span className="flex items-baseline justify-between gap-3 px-4 pt-3 sm:px-5">
              <span className="font-display text-lg font-semibold">
                Where your books meet
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {summary}
              </span>
            </span>
            <span className="relative block h-64 sm:h-80">
              <ReadingMapSvg map={map} mode="preview" selected={null} />
              <Maximize2
                aria-hidden
                className="absolute right-3 bottom-3 size-4 text-muted-foreground/60 transition-colors group-hover:text-primary"
              />
            </span>
          </button>
        </DialogTrigger>
      </section>

      <DialogContent className="flex h-[100dvh] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[85vh] sm:max-w-5xl sm:rounded-xl">
        <MapDialogBody map={map} summary={summary} />
      </DialogContent>
    </Dialog>
  );
}

function MapDialogBody({
  map,
  summary,
}: {
  map: ReadingMapData;
  summary: string;
}) {
  const index = useIndex(map);
  const [view, setView] = React.useState<"map" | "list">("map");
  const [selected, setSelected] = React.useState<MapSelection | null>(null);
  const [zoomStep, setZoomStep] = React.useState(0);

  const focus = selected
    ? selected.kind === "book"
      ? index.bookById.get(selected.id)
      : index.genreById.get(selected.id)
    : undefined;
  const k = ZOOM_STEPS[zoomStep] ?? 1;
  const viewBox = zoomViewBox(
    map,
    k,
    focus?.x ?? map.width / 2,
    focus?.y ?? map.height / 2
  );

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b bg-accent/30 py-3 pr-12 pl-4 sm:px-6 sm:py-4 sm:pr-14">
        <div className="min-w-0 flex-1">
          <DialogTitle className="font-display text-xl font-bold tracking-tight">
            Your reading map
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {summary}.
            <span className="hidden sm:inline">
              {" "}
              Books sit between the genres they belong to.
            </span>
          </DialogDescription>
        </div>
        <ViewToggle value={view} onChange={setView} />
      </header>

      {view === "map" ? (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="relative h-[48dvh] shrink-0 bg-card md:h-auto md:min-w-0 md:flex-1">
            <ReadingMapSvg
              map={map}
              mode="full"
              selected={selected}
              onSelect={setSelected}
              viewBox={viewBox}
            />
            <ZoomControls
              step={zoomStep}
              onChange={setZoomStep}
              className="absolute top-3 right-3"
            />
            <Legend className="absolute bottom-3 left-3" />
          </div>
          <p aria-live="polite" className="sr-only">
            {selectionStatus(selected, index)}
          </p>
          <aside
            className="min-h-0 flex-1 overflow-y-auto border-t bg-background p-4 md:w-72 md:flex-none md:border-t-0 md:border-l md:p-5"
          >
            <DetailPanel
              map={map}
              index={index}
              selected={selected}
              onSelect={setSelected}
            />
          </aside>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <ListView map={map} index={index} />
        </div>
      )}
    </>
  );
}

/* Styled like RangeToggle in reading-stats: two buttons, aria-pressed. */
function ViewToggle({
  value,
  onChange,
}: {
  value: "map" | "list";
  onChange: (v: "map" | "list") => void;
}) {
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex rounded-md border bg-card p-0.5 shadow-xs"
    >
      {(
        [
          { v: "map", label: "Map", Icon: MapIcon },
          { v: "list", label: "List", Icon: List },
        ] as const
      ).map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-sm px-3 py-1 text-xs font-medium transition-colors",
            value === v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function ZoomControls({
  step,
  onChange,
  className,
}: {
  step: number;
  onChange: (step: number) => void;
  className?: string;
}) {
  const last = ZOOM_STEPS.length - 1;
  const buttons = [
    { label: "Zoom in", Icon: ZoomIn, to: Math.min(step + 1, last), disabled: step >= last },
    { label: "Zoom out", Icon: ZoomOut, to: Math.max(step - 1, 0), disabled: step <= 0 },
    { label: "Reset zoom", Icon: RotateCcw, to: 0, disabled: step === 0 },
  ];
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-md border bg-card/85 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      {buttons.map(({ label, Icon, to, disabled }) => (
        <Button
          key={label}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(to)}
          className="rounded-none"
        >
          <Icon />
        </Button>
      ))}
    </div>
  );
}

function Legend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-card/85 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm",
        className
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <CoverMark shelf="library" /> Library
      </span>
      <span className="inline-flex items-center gap-1.5">
        <CoverMark shelf="wishlist" /> Wishlist
      </span>
      <span className="hidden sm:inline">Lines connect books to their genres</span>
    </div>
  );
}

/**
 * Legend marker for a book on the map: a dot beside a little cover, solid for
 * library, dashed for wishlist — books without a cover stay dots.
 */
function CoverMark({ shelf }: { shelf: BookNode["shelf"] }) {
  const wish = shelf === "wishlist";
  return (
    <svg aria-hidden viewBox="0 0 22 14" className="h-3 w-[1.1rem] shrink-0 overflow-visible">
      <circle
        cx="4"
        cy="7"
        r={wish ? 3.1 : 3.4}
        className={wish ? "fill-card stroke-primary" : "fill-primary"}
        strokeWidth="1.2"
        strokeDasharray={wish ? "1.8 1.3" : undefined}
      />
      <rect
        x="11"
        y="0.75"
        width="8.5"
        height="12.5"
        rx="1.4"
        className={wish ? "fill-primary/25 stroke-primary" : "fill-primary"}
        strokeWidth="1.2"
        strokeDasharray={wish ? "2 1.4" : undefined}
      />
    </svg>
  );
}

/** The map's dot, as an inline marker: filled for library, dashed for wishlist. */
function BookDot({ shelf }: { shelf: BookNode["shelf"] }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 shrink-0">
      {shelf === "library" ? (
        <circle cx="5" cy="5" r="4" className="fill-primary" />
      ) : (
        <circle
          cx="5"
          cy="5"
          r="3.75"
          className="fill-card stroke-primary"
          strokeWidth="1.3"
          strokeDasharray="2 1.5"
        />
      )}
    </svg>
  );
}

function Chip({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}

function DetailPanel({
  map,
  index,
  selected,
  onSelect,
}: {
  map: ReadingMapData;
  index: Index;
  selected: MapSelection | null;
  onSelect: (s: MapSelection) => void;
}) {
  const book = selected?.kind === "book" ? index.bookById.get(selected.id) : undefined;
  const genre = selected?.kind === "genre" ? index.genreById.get(selected.id) : undefined;

  if (book) {
    return <BookDetail key={book.id} book={book} index={index} onSelect={onSelect} />;
  }
  if (genre) {
    return <GenreDetail key={genre.id} genre={genre} index={index} onSelect={onSelect} />;
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-start gap-3">
        <PawPrint className="mt-0.5 w-6 shrink-0 text-primary/50" />
        <div>
          <p className="font-display text-base font-semibold">Tap a genre or a book</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Its connections light up. Dashed outlines are still on your wishlist.
          </p>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Biggest genres
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {map.topGenreIds.map((id) => {
            const g = index.genreById.get(id);
            if (!g) return null;
            return (
              <Chip key={id} onClick={() => onSelect({ kind: "genre", id })}>
                {g.label}
                <span className="ml-1 text-muted-foreground tabular-nums">{g.bookCount}</span>
              </Chip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BookDetail({
  book,
  index,
  onSelect,
}: {
  book: BookNode;
  index: Index;
  onSelect: (s: MapSelection) => void;
}) {
  const wish = book.shelf === "wishlist";
  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex gap-4 md:flex-col">
        <div className="relative aspect-2/3 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted shadow-sm md:w-28">
          <BookCoverImage
            src={book.cover}
            alt=""
            fill
            sizes="112px"
            className="object-cover"
            fallback={
              <BookOpen className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/40" />
            }
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              wish ? "border-dashed border-primary/50 text-primary" : "bg-primary text-primary-foreground border-transparent"
            )}
          >
            {wish ? "Wishlist" : "Library"}
          </span>
          <h3 className="font-display text-lg leading-tight font-bold text-balance">
            {book.title}
          </h3>
          {book.author && <p className="text-sm text-muted-foreground">{book.author}</p>}
          {book.rating != null ? (
            <StarRatingDisplay value={book.rating} />
          ) : (
            wish && (
              <CommunityRating rating={book.olRating} count={book.olRatingCount} checked />
            )
          )}
        </div>
      </div>

      {book.genreIds.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Genres
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {book.genreIds.map((id) => {
              const g = index.genreById.get(id);
              if (!g) return null;
              return (
                <Chip key={id} onClick={() => onSelect({ kind: "genre", id })}>
                  {g.label}
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      <Button asChild className="w-full">
        <Link href={`/books/${book.id}`}>
          Open book <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

function GenreDetail({
  genre,
  index,
  onSelect,
}: {
  genre: GenreNode;
  index: Index;
  onSelect: (s: MapSelection) => void;
}) {
  const children = index.childrenOf(genre.id);
  const books = index.booksOf(genre.id);
  const parent = genre.parentId ? index.genreById.get(genre.parentId) : undefined;

  return (
    <div className="animate-fade-up space-y-4">
      <div>
        {parent && (
          <button
            type="button"
            onClick={() => onSelect({ kind: "genre", id: parent.id })}
            className="text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            {parent.label} /
          </button>
        )}
        <h3 className="font-display text-xl leading-tight font-bold">{genre.label}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
          {plural(books.length, "book")}
        </p>
      </div>

      {children.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {children.map((c) => (
            <Chip key={c.id} onClick={() => onSelect({ kind: "genre", id: c.id })}>
              {c.label}
            </Chip>
          ))}
        </div>
      )}

      <ul className="-mx-2 space-y-0.5">
        {books.map((b) => (
          <li key={b.id} className="group flex items-center gap-1 rounded-md hover:bg-accent/60">
            <button
              type="button"
              onClick={() => onSelect({ kind: "book", id: b.id })}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <BookDot shelf={b.shelf} />
              <span className="truncate">{b.title}</span>
            </button>
            <Link
              href={`/books/${b.id}`}
              aria-label={`Open ${b.title}`}
              className="mr-1 rounded-sm p-1 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 hover:text-primary focus-visible:opacity-100"
            >
              <ExternalLink className="size-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The keyboard and screen-reader path through the same data. */
function ListView({ map, index }: { map: ReadingMapData; index: Index }) {
  const roots = React.useMemo(
    () =>
      map.genres
        .filter((g) => !g.parentId || !index.genreById.has(g.parentId))
        .sort((a, b) => b.bookCount - a.bookCount),
    [map.genres, index]
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {roots.map((root) => {
        const children = index
          .childrenOf(root.id)
          .sort((a, b) => b.bookCount - a.bookCount || a.label.localeCompare(b.label));
        const childIds = new Set(children.map((c) => c.id));
        // A book filed under a child genre is listed there only.
        const direct = map.books.filter(
          (b) => b.genreIds.includes(root.id) && !b.genreIds.some((g) => childIds.has(g))
        );
        return (
          <section key={root.id} aria-labelledby={`list-${root.id}`}>
            <h3
              id={`list-${root.id}`}
              className="flex items-baseline gap-2 border-b pb-1.5 font-display text-lg font-semibold"
            >
              {root.label}
              <span className="font-sans text-xs font-normal text-muted-foreground tabular-nums">
                {plural(index.booksOf(root.id).length, "book")}
              </span>
            </h3>
            <BookList books={direct} />
            {children.map((child) => (
              <div key={child.id} className="mt-4 pl-3 sm:pl-4">
                <h4 className="flex items-baseline gap-2 text-sm font-semibold">
                  {child.label}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {plural(index.booksOf(child.id).length, "book")}
                  </span>
                </h4>
                <BookList books={map.books.filter((b) => b.genreIds.includes(child.id))} />
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function BookList({ books }: { books: BookNode[] }) {
  if (books.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5">
      {books.map((b) => (
        <li key={b.id}>
          <Link
            href={`/books/${b.id}`}
            className="flex items-center gap-2.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <BookDot shelf={b.shelf} />
            <span className="min-w-0">
              <span className="font-medium">{b.title}</span>
              {b.author && <span className="text-muted-foreground"> — {b.author}</span>}
              {b.shelf === "wishlist" && (
                <span className="ml-1.5 text-xs text-primary">(wishlist)</span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import { Suspense } from "react";
import { getDescription } from "@/lib/booksearch";

function DescriptionSkeleton() {
  return (
    <section className="mt-6" aria-hidden="true">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-3 space-y-2">
        <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-11/12 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
      </div>
    </section>
  );
}

function DescriptionBody({ text }: { text: string }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-semibold">About this book</h2>
      {/* Provider blurbs are plain text with hard line breaks */}
      <div className="mt-2 space-y-3 text-sm leading-7 text-muted-foreground">
        {text
          .split(/\n{2,}/)
          .slice(0, 6)
          .map((para, i) => (
            <p key={i}>{para.replace(/\s*\n\s*/g, " ").trim()}</p>
          ))}
      </div>
    </section>
  );
}

/**
 * Only reached when there's no description in hand already. The lookup can
 * take seconds, so it streams in behind Suspense rather than holding up the
 * rest of the page.
 */
async function StreamedDescription({ olKey }: { olKey: string }) {
  const description = await getDescription(olKey);
  if (!description) return null;
  return <DescriptionBody text={description} />;
}

/**
 * A book's blurb: shown immediately when already known (a saved row), or
 * streamed in from the provider when not (a fresh search hit's preview).
 */
export function BookDescription({
  olKey,
  initial,
}: {
  olKey: string;
  initial: string | null;
}) {
  if (initial) return <DescriptionBody text={initial} />;
  return (
    <Suspense fallback={<DescriptionSkeleton />}>
      <StreamedDescription olKey={olKey} />
    </Suspense>
  );
}

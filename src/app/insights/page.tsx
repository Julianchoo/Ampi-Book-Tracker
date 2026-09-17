import { InsightsCharts } from "@/components/books/insights-charts";
import { DachshundReading } from "@/components/dachshund";
import { buildInsights } from "@/lib/insights";
import { getInsightsBooks } from "@/lib/queries";
import { requireAuth } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Insights" };

export default async function InsightsPage() {
  const session = await requireAuth();
  const books = await getInsightsBooks(session.user.id);
  const year = new Date().getFullYear();
  // Both ranges are built on the server so the toggle needs no round trip —
  // the same trick as the home stats.
  const all = buildInsights(books, { range: "all", year });
  const thisYear = buildInsights(books, { range: "year", year });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <header className="mb-5">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Insights
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The eras you read, the genres you like, and how generous your ratings
          are.
        </p>
      </header>

      {all.counts.read === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <DachshundReading className="w-44 text-primary/45" />
          <p className="mt-4 font-display text-lg font-semibold">
            Nothing to chart yet
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Finish a book and rate it — the shape of your reading will start
            showing up here.
          </p>
        </div>
      ) : (
        <InsightsCharts all={all} thisYear={thisYear} />
      )}
    </div>
  );
}

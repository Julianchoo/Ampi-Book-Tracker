"use client";

import * as React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { MAX_RATING } from "@/lib/books";
import type { ReadingStats } from "@/lib/queries";

/*
 * One chart, two marks, and deliberately ONE y-axis.
 *
 * Bars are a count of books and the line is a 0-10 rating, so a second y-axis
 * would let the two be scaled independently — which is how dual-axis charts
 * manufacture correlations that aren't there. They share a single 0-10 scale
 * instead, which is honest because a month's finished-count is almost always
 * within that range; the domain stretches if a month ever beats it.
 */

const chartConfig = {
  finished: { label: "Books finished", color: "var(--chart-1)" },
  avgRating: { label: "Average rating", color: "var(--star)" },
} satisfies ChartConfig;

/** "2026-03" -> "Mar 26" */
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-3 shadow-sm sm:p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-bold tabular-nums sm:text-3xl">
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ReadingStatsCharts({ stats }: { stats: ReadingStats }) {
  const data = React.useMemo(
    () =>
      stats.byMonth.map((m) => ({
        ...m,
        label: monthLabel(m.month),
      })),
    [stats.byMonth]
  );

  // One shared scale. 10 is the rating ceiling and also covers a normal
  // reading month; a bumper month stretches it rather than being clipped.
  const axisMax = React.useMemo(
    () => Math.max(MAX_RATING, ...data.map((d) => d.finished)),
    [data]
  );

  return (
    <section aria-labelledby="stats-heading" className="space-y-4">
      <h2 id="stats-heading" className="font-display text-xl font-semibold">
        Your reading
      </h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Finished" value={String(stats.totalFinished)} />
        <StatTile label="Reading now" value={String(stats.totalReading)} />
        <StatTile
          label="Average rating"
          value={stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"}
          {...(stats.avgRating != null ? { sub: `out of ${MAX_RATING}` } : {})}
        />
        <StatTile label="On wishlist" value={String(stats.wishlistCount)} />
      </div>

      {data.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Finish a book and give it a date — your reading year will start
          drawing itself here.
        </p>
      ) : (
        <div className="min-w-0 rounded-lg border bg-card p-3 shadow-sm sm:p-4">
          <h3 className="text-sm font-semibold">
            Books finished and average rating by month
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Both series share one 0&ndash;{axisMax} scale.
          </p>
          <ChartContainer
            config={chartConfig}
            className="mt-2 h-[260px] w-full"
          >
            <ResponsiveContainer>
              <ComposedChart
                data={data}
                margin={{ top: 8, right: 12, bottom: 0, left: -18 }}
              >
                <CartesianGrid vertical={false} strokeOpacity={0.4} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  fontSize={11}
                />
                <YAxis
                  domain={[0, axisMax]}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  fontSize={11}
                />
                <ChartTooltip
                  cursor={{ fillOpacity: 0.08 }}
                  content={<ChartTooltipContent />}
                />
                <Legend
                  verticalAlign="bottom"
                  height={28}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar
                  dataKey="finished"
                  name="Books finished"
                  fill="var(--color-finished)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                />
                <Line
                  type="monotone"
                  dataKey="avgRating"
                  name="Average rating"
                  stroke="var(--color-avgRating)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {/* Colour is never the only channel: the same numbers, readable. */}
      {data.length > 0 && (
        <details className="rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
          <summary className="cursor-pointer font-medium">
            View as a table
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1 pr-4 font-medium">Month</th>
                  <th scope="col" className="py-1 pr-4 font-medium">Finished</th>
                  <th scope="col" className="py-1 font-medium">Avg rating</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.month} className="border-t">
                    <td className="py-1 pr-4">{d.label}</td>
                    <td className="py-1 pr-4 tabular-nums">{d.finished}</td>
                    <td className="py-1 tabular-nums">
                      {d.avgRating != null ? d.avgRating.toFixed(1) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

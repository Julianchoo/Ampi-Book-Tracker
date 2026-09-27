/*
 * Calendar-month helpers for the "This month" stat tile.
 *
 * Months are "YYYY-MM" strings — the same shape Postgres' to_char produces for
 * the byMonth rows — so they sort lexically and compare with ===. Everything
 * is UTC so the server (which picks the current month) and the browser (which
 * renders labels) can never disagree about which month a key names.
 */

/** "YYYY-MM" for the given instant, in UTC. */
export function monthKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

/** Parses "YYYY-MM"; null for anything malformed. */
function parseMonth(month: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) return null;
  return { year: y, month: m };
}

/**
 * "2026-09" -> "September 2026" (long) or "Sep 2026" (short).
 * Falls back to the raw key rather than rendering "Invalid Date".
 */
export function formatMonth(month: string, style: "long" | "short" = "long"): string {
  const parsed = parseMonth(month);
  if (!parsed) return month;
  return new Date(Date.UTC(parsed.year, parsed.month - 1, 1)).toLocaleDateString("en-GB", {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  });
}

export type MonthOption = { month: string; finished: number };
export type MonthOptionGroup = { year: number; months: MonthOption[] };

/**
 * Every month from the earliest one with data through `currentMonth`, newest
 * first and grouped by year, with 0 for months nothing was finished in.
 *
 * Gaps are filled deliberately: a reader picking "last March" should find it
 * even if they finished nothing then — a missing entry would read as a bug,
 * a 0 reads as an answer. Months after `currentMonth` (a finished-date typed
 * in the future) are ignored; they can't be "this month" yet.
 */
export function buildMonthOptions(
  byMonth: readonly { month: string; finished: number }[],
  currentMonth: string
): MonthOptionGroup[] {
  const end = parseMonth(currentMonth);
  if (!end) return [];

  const counts = new Map<string, number>();
  let earliest = currentMonth;
  for (const row of byMonth) {
    if (!parseMonth(row.month)) continue;
    counts.set(row.month, row.finished);
    if (row.month < earliest) earliest = row.month;
  }
  // `earliest` is either currentMonth or a key that parsed above.
  const start = parseMonth(earliest) ?? end;

  const groups: MonthOptionGroup[] = [];
  let { year, month } = end;
  while (year > start.year || (year === start.year && month >= start.month)) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    let group = groups[groups.length - 1];
    if (!group || group.year !== year) {
      group = { year, months: [] };
      groups.push(group);
    }
    group.months.push({ month: key, finished: counts.get(key) ?? 0 });

    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return groups;
}

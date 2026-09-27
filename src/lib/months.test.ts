// Run: node --experimental-strip-types --test src/lib/months.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMonthOptions, formatMonth, monthKey } from "./months.ts";

test("monthKey uses UTC and zero-pads", () => {
  assert.equal(monthKey(new Date(Date.UTC(2026, 0, 15))), "2026-01");
  // 23:30 on 30 Sep UTC is still September, whatever the local zone says.
  assert.equal(monthKey(new Date("2026-09-30T23:30:00Z")), "2026-09");
});

test("formatMonth renders long and short English labels", () => {
  assert.equal(formatMonth("2026-09"), "September 2026");
  assert.equal(formatMonth("2026-08", "short"), "Aug 2026");
  assert.equal(formatMonth("nonsense"), "nonsense");
  assert.equal(formatMonth("2026-13"), "2026-13");
});

test("no data yields only the current month, with 0", () => {
  assert.deepEqual(buildMonthOptions([], "2026-09"), [
    { year: 2026, months: [{ month: "2026-09", finished: 0 }] },
  ]);
});

test("fills gaps with 0, newest first, grouped by year", () => {
  const groups = buildMonthOptions(
    [
      { month: "2025-11", finished: 2 },
      { month: "2026-02", finished: 5 },
    ],
    "2026-03"
  );
  assert.deepEqual(groups, [
    {
      year: 2026,
      months: [
        { month: "2026-03", finished: 0 },
        { month: "2026-02", finished: 5 },
        { month: "2026-01", finished: 0 },
      ],
    },
    {
      year: 2025,
      months: [
        { month: "2025-12", finished: 0 },
        { month: "2025-11", finished: 2 },
      ],
    },
  ]);
});

test("ignores future-dated months and malformed keys", () => {
  const groups = buildMonthOptions(
    [
      { month: "2026-08", finished: 1 },
      { month: "2026-12", finished: 9 },
      { month: "bad", finished: 4 },
    ],
    "2026-09"
  );
  assert.deepEqual(groups, [
    {
      year: 2026,
      months: [
        { month: "2026-09", finished: 0 },
        { month: "2026-08", finished: 1 },
      ],
    },
  ]);
});

test("malformed current month yields no options", () => {
  assert.deepEqual(buildMonthOptions([{ month: "2026-01", finished: 1 }], "x"), []);
});

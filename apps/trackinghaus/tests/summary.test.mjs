import assert from "node:assert/strict";
import test from "node:test";
import { buildWeeklySummary } from "../lib/summary.js";

test("builds a seven-day reading and compares it with the previous week", () => {
  const rows = [
    {
      day: "2026-08-01",
      path: "/quiet-software",
      title: "Quiet Software",
      source: "search",
      reads: 3,
      returning_reads: 0,
    },
    {
      day: "2026-08-05",
      path: "/quiet-software",
      title: "Quiet Software",
      source: "search",
      reads: 9,
      returning_reads: 2,
    },
    {
      day: "2026-08-06",
      path: "/quiet-software",
      title: "Quiet Software",
      source: "direct",
      reads: 4,
      returning_reads: 1,
    },
  ];

  const summary = buildWeeklySummary(rows, {
    endDate: "2026-08-09",
    today: "2026-08-09",
  });

  assert.equal(summary.days.length, 7);
  assert.equal(summary.insight.total, 13);
  assert.equal(summary.insight.search, 9);
  assert.equal(summary.insight.returning, 3);
  assert.equal(summary.writing[0].change, 10);
  assert.equal(summary.insight.headline, "Search brought an essay back into view.");
  assert.equal(summary.days.at(-1).today, true);
  assert.equal(summary.days[0].date, "8/3");
  assert.equal(summary.days.at(-1).date, "8/9");
  assert.equal(
    summary.evidenceNote,
    "Search accounted for 69% of this week’s reading. No individual visitors are identified. Trackinghaus alpha stores only aggregate counters.",
  );
});

test("returns a quiet first-run reading when there is no data", () => {
  const summary = buildWeeklySummary([], { endDate: "2026-08-09" });
  assert.equal(summary.insight.total, 0);
  assert.equal(summary.writing.length, 0);
  assert.equal(summary.insight.headline, "Not enough happened yet.");
  assert.equal(
    summary.evidenceNote,
    "No individual visitors are identified. Trackinghaus alpha stores only aggregate counters.",
  );
});

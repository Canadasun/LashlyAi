import assert from "node:assert/strict";
import test from "node:test";
import { aggregateByGlue, aggregateByLashSet, estimateNextFill } from "./retentionInsights.service";

test("estimateNextFill projects forward from the most recent check", () => {
  // 20% lost over 14 days -> 1.4286%/day -> hits the 60% threshold at day ~28
  const result = estimateNextFill([
    { days_since_application: 14, retention_pct: 80, lash_set: "classic", style: "classic", glue_used: null },
  ]);
  assert.ok(result);
  assert.equal(result!.estimated_fill_day, 28);
  assert.equal(result!.estimated_days_remaining, 14);
});

test("estimateNextFill returns null with no checks", () => {
  assert.equal(estimateNextFill([]), null);
});

test("estimateNextFill returns null when retention hasn't dropped at all", () => {
  const result = estimateNextFill([
    { days_since_application: 10, retention_pct: 100, lash_set: "classic", style: "classic", glue_used: null },
  ]);
  assert.equal(result, null);
});

test("estimateNextFill floors days-remaining at 0 once already past the threshold", () => {
  const result = estimateNextFill([
    { days_since_application: 30, retention_pct: 40, lash_set: "classic", style: "classic", glue_used: null },
  ]);
  assert.ok(result);
  assert.equal(result!.estimated_days_remaining, 0);
});

test("aggregateByLashSet groups by lash_set, falling back to style, sorted best-first", () => {
  const rows = aggregateByLashSet([
    { days_since_application: 14, retention_pct: 90, lash_set: "volume", style: "volume", glue_used: null },
    { days_since_application: 14, retention_pct: 70, lash_set: "volume", style: "volume", glue_used: null },
    { days_since_application: 14, retention_pct: 50, lash_set: null, style: "cat-eye", glue_used: null },
  ]);
  assert.deepEqual(rows, [
    { label: "volume", average_retention_pct: 80, sample_size: 2 },
    { label: "cat-eye", average_retention_pct: 50, sample_size: 1 },
  ]);
});

test("aggregateByGlue skips checks with no glue_used recorded", () => {
  const rows = aggregateByGlue([
    { days_since_application: 14, retention_pct: 90, lash_set: "classic", style: "classic", glue_used: "Glue A" },
    { days_since_application: 14, retention_pct: 60, lash_set: "classic", style: "classic", glue_used: null },
  ]);
  assert.deepEqual(rows, [{ label: "Glue A", average_retention_pct: 90, sample_size: 1 }]);
});

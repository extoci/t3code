import { describe, expect, it } from "vite-plus/test";

import type { UsagePeriodTotals } from "@t3tools/shared/usageMerge";
import type { UsagePeriod } from "@t3tools/shared/usageFormat";
import { buildPeriodColumns, niceScale } from "./UsageProviderChart";

describe("niceScale", () => {
  it("never puts the peak above the top of the scale", () => {
    // Regression: an earlier version stopped at the last step below the peak,
    // so the tallest day was drawn past the plot and clipped.
    for (const peak of [1122.71, 999, 1, 0.04, 1_400_000_000, 37.5, 5000, 100.001]) {
      const { max } = niceScale(peak, 4);
      expect(max, `peak ${peak}`).toBeGreaterThanOrEqual(peak);
    }
  });

  it("starts at zero and ends at the maximum", () => {
    const { max, ticks } = niceScale(1122.71, 4);

    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBeCloseTo(max, 6);
  });

  it("uses evenly spaced 1/2/5 steps", () => {
    const { ticks } = niceScale(1122.71, 4);
    const steps = ticks.slice(1).map((tick, index) => tick - (ticks[index] ?? 0));

    for (const step of steps) expect(step).toBeCloseTo(steps[0] ?? 0, 6);
    const [first = 0] = steps;
    const normalized = first / 10 ** Math.floor(Math.log10(first));
    expect([1, 2, 5, 10]).toContain(Math.round(normalized));
  });

  it("keeps the tick count near the requested resolution", () => {
    const { ticks } = niceScale(1122.71, 4);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(7);
  });

  it("degrades to a single zero tick with no data", () => {
    expect(niceScale(0, 4)).toEqual({ max: 0, ticks: [0] });
  });
});

describe("buildPeriodColumns", () => {
  const periods = [
    { key: "2026-08-01T00", day: "2026-08-01", startHour: 0 },
    { key: "2026-08-01T06", day: "2026-08-01", startHour: 6 },
    { key: "2026-08-01T12", day: "2026-08-01", startHour: 12 },
  ] satisfies readonly UsagePeriod[];
  const byPeriod = new Map<string, UsagePeriodTotals>([
    [
      "2026-08-01T00",
      {
        key: "2026-08-01T00",
        day: "2026-08-01",
        startHour: 0,
        costUsd: 30,
        totalTokens: 300,
        byProvider: new Map([
          ["codex" as const, { costUsd: 10, totalTokens: 100 }],
          ["claude" as const, { costUsd: 20, totalTokens: 200 }],
        ]),
      },
    ],
    // The 06:00 period is deliberately absent: an interval with no activity.
    [
      "2026-08-01T12",
      {
        key: "2026-08-01T12",
        day: "2026-08-01",
        startHour: 12,
        costUsd: 5,
        totalTokens: 50,
        byProvider: new Map([["claude" as const, { costUsd: 5, totalTokens: 50 }]]),
      },
    ],
  ]);

  it("plots each period on its own", () => {
    expect(buildPeriodColumns(periods, byPeriod, "cost").map((column) => column.total)).toEqual([
      30, 0, 5,
    ]);
  });

  it("reads the requested metric", () => {
    expect(buildPeriodColumns(periods, byPeriod, "tokens").map((column) => column.total)).toEqual([
      300, 0, 50,
    ]);
  });

  it("keeps band values absolute rather than cumulative", () => {
    // Regression: the bands were once stack offsets, which drew Claude Code
    // permanently above Codex regardless of which provider spent more.
    const [first] = buildPeriodColumns(periods, byPeriod, "cost");

    expect(first?.bands).toEqual([
      { provider: "codex", value: 10 },
      { provider: "claude", value: 20 },
    ]);
  });

  it("reports the total as the sum of its bands", () => {
    for (const column of buildPeriodColumns(periods, byPeriod, "cost")) {
      const sum = column.bands.reduce((running, band) => running + band.value, 0);
      expect(column.total).toBeCloseTo(sum, 9);
    }
  });
});

import { describe, expect, it } from "vite-plus/test";

import type { UsagePeriodTotals } from "@t3tools/shared/usageMerge";
import { enumerateUsagePeriods } from "@t3tools/shared/usageFormat";
import { buildChartPeriods } from "./usageChartData";

describe("buildChartPeriods", () => {
  it("zero-fills six-hour periods with no activity", () => {
    const periods = enumerateUsagePeriods("2026-08-11", "2026-08-11", 6);
    const totals: UsagePeriodTotals[] = [
      {
        key: "2026-08-11T06",
        day: "2026-08-11",
        startHour: 6,
        costUsd: 4,
        totalTokens: 400,
        byProvider: new Map([["codex", { costUsd: 4, totalTokens: 400 }]]),
      },
    ];

    expect(buildChartPeriods(periods, totals, "cost").map((period) => period.total)).toEqual([
      0, 4, 0, 0,
    ]);
  });
});

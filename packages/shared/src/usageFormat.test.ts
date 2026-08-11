// @effect-diagnostics globalDate:off -- Verifies calendar windows against a fixed wall-clock date.
import { describe, expect, it } from "vite-plus/test";

import { enumerateUsagePeriods, formatUsagePeriod, makeWindow } from "./usageFormat.ts";

describe("makeWindow", () => {
  it("uses a single current calendar day for a one-day window", () => {
    const window = makeWindow(1, new Date(2026, 7, 11, 12));

    expect(window.sinceDay).toBe("2026-08-11");
    expect(window.untilDay).toBe("2026-08-11");
    expect(window.bucketHours).toBe(6);
  });

  it("uses daily buckets for longer windows", () => {
    expect(makeWindow(7, new Date(2026, 7, 11, 12)).bucketHours).toBe(24);
  });
});

describe("enumerateUsagePeriods", () => {
  it("returns four labeled six-hour periods for one day", () => {
    const periods = enumerateUsagePeriods("2026-08-11", "2026-08-11", 6);

    expect(periods.map((period) => period.startHour)).toEqual([0, 6, 12, 18]);
    expect(periods.map((period) => formatUsagePeriod(period, 6))).toEqual([
      "Aug 11, 12 AM–6 AM",
      "Aug 11, 6 AM–12 PM",
      "Aug 11, 12 PM–6 PM",
      "Aug 11, 6 PM–12 AM",
    ]);
  });
});

// @effect-diagnostics globalDate:off -- Verifies calendar windows against a fixed wall-clock date.
import { describe, expect, it } from "vite-plus/test";

import { makeWindow } from "./usageFormat.ts";

describe("makeWindow", () => {
  it("uses a single current calendar day for a one-day window", () => {
    const window = makeWindow(1, new Date(2026, 7, 11, 12));

    expect(window.sinceDay).toBe("2026-08-11");
    expect(window.untilDay).toBe("2026-08-11");
  });
});

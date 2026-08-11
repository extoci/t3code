import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import { UsageSummary, UsageSummaryInput } from "./usage.ts";

const decodeSummaryInput = Schema.decodeUnknownSync(UsageSummaryInput);
const decodeSummary = Schema.decodeUnknownSync(UsageSummary);

describe("usage contract compatibility", () => {
  it("defaults older requests to daily buckets", () => {
    const decoded = decodeSummaryInput({
      sinceDay: "2026-08-11",
      untilDay: "2026-08-11",
      timeZone: "UTC",
    });

    expect(decoded.bucketHours).toBe(24);
  });

  it("decodes older summaries before excluding them by contract version", () => {
    const decoded = decodeSummary({
      contractVersion: 3,
      readAt: "2026-08-11T12:00:00.000Z",
      timeZone: "UTC",
      sinceDay: "2026-08-11",
      untilDay: "2026-08-11",
      buckets: [
        {
          day: "2026-08-11",
          provider: "codex",
          model: "gpt-5.6-sol",
          totals: {
            uncachedInputTokens: 1,
            cachedInputTokens: 0,
            cacheCreationTokens: 0,
            outputTokens: 1,
            reasoningTokens: 0,
          },
          costUsd: 0,
          cacheSavingsUsd: 0,
          costSource: "unpriced",
          records: 1,
          unpricedRecords: 1,
          sessions: 1,
        },
      ],
      sources: [],
      pricing: { status: "unavailable", source: "test", fetchedAt: null, knownModels: 0 },
      scanDurationMs: 1,
    });

    expect(decoded.bucketHours).toBe(24);
    expect(decoded.buckets[0]?.startHour).toBe(0);
  });
});

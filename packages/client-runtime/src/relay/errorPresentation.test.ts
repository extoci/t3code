import { RelayAuthInvalidError } from "@t3tools/contracts/relay";
import { describe, expect, it } from "@effect/vitest";

import { DPOP_CLOCK_HINT, relayProtectedErrorMessage } from "./errorPresentation.ts";

describe("relayProtectedErrorMessage", () => {
  it("uses the clock hint when an older relay omits the DPoP failure reason", () => {
    const error = new RelayAuthInvalidError({
      code: "auth_invalid",
      reason: "invalid_dpop",
      traceId: "trace-1",
    });

    expect(relayProtectedErrorMessage(error)).toBe(
      `Relay rejected the DPoP proof.\n\n${DPOP_CLOCK_HINT}`,
    );
  });

  it("keeps the clock hint for a relay that confirms a time-window failure", () => {
    const error = new RelayAuthInvalidError({
      code: "auth_invalid",
      reason: "invalid_dpop",
      dpopFailureReason: "time_window",
      traceId: "trace-1",
    });

    expect(relayProtectedErrorMessage(error)).toContain(DPOP_CLOCK_HINT);
  });

  it("does not blame the clock when the relay identifies another proof failure", () => {
    const error = new RelayAuthInvalidError({
      code: "auth_invalid",
      reason: "invalid_dpop",
      dpopFailureReason: "key_mismatch",
      traceId: "trace-1",
    });

    expect(relayProtectedErrorMessage(error)).toBe(
      "Relay rejected the DPoP proof.\n\nHint: Try again. If the problem continues, copy the trace ID.",
    );
  });

  it("preserves the existing message for other authentication failures", () => {
    const error = new RelayAuthInvalidError({
      code: "auth_invalid",
      reason: "invalid_bearer",
      traceId: "trace-1",
    });

    expect(relayProtectedErrorMessage(error)).toBe("Relay rejected the cloud session token.");
  });
});

import { EnvironmentAuthInvalidError } from "@t3tools/contracts";
import { RelayAuthInvalidError } from "@t3tools/contracts/relay";
import { describe, expect, it } from "@effect/vitest";

import { mapManagedRelayError, mapRemoteDpopEnvironmentError } from "./errors.ts";
import { DPOP_CLOCK_HINT, DPOP_RETRY_HINT } from "../relay/errorPresentation.ts";
import { ManagedRelayRequestFailedError } from "../relay/managedRelay.ts";

describe("mapManagedRelayError", () => {
  it("shows the clock hint when an older relay returns a generic DPoP error", () => {
    const mapped = mapManagedRelayError(
      new ManagedRelayRequestFailedError({
        action: "connect relay environment",
        cause: new Error("request failed"),
        relayError: new RelayAuthInvalidError({
          code: "auth_invalid",
          reason: "invalid_dpop",
          traceId: "trace-1",
        }),
        traceId: "trace-1",
      }),
    );

    expect(mapped).toMatchObject({
      _tag: "ConnectionBlockedError",
      reason: "authentication",
      detail: `Relay rejected the DPoP proof.\n\n${DPOP_CLOCK_HINT}`,
      traceId: "trace-1",
    });
  });

  it("uses a neutral hint when the relay identifies a non-clock DPoP error", () => {
    const mapped = mapManagedRelayError(
      new ManagedRelayRequestFailedError({
        action: "connect relay environment",
        cause: new Error("request failed"),
        relayError: new RelayAuthInvalidError({
          code: "auth_invalid",
          reason: "invalid_dpop",
          dpopFailureReason: "key_mismatch",
          traceId: "trace-1",
        }),
      }),
    );

    expect(mapped.message).toBe(`Relay rejected the DPoP proof.\n\n${DPOP_RETRY_HINT}`);
  });
});

describe("mapRemoteDpopEnvironmentError", () => {
  it("uses the clock hint when an older environment server returns a generic auth error", () => {
    const mapped = mapRemoteDpopEnvironmentError(
      new EnvironmentAuthInvalidError({
        code: "auth_invalid",
        reason: "invalid_credential",
        traceId: "trace-1",
      }),
    );

    expect(mapped.message).toBe(`The environment credential is invalid.\n\n${DPOP_CLOCK_HINT}`);
  });

  it("uses a neutral hint for a non-clock DPoP error from a new server", () => {
    const mapped = mapRemoteDpopEnvironmentError(
      new EnvironmentAuthInvalidError({
        code: "auth_invalid",
        reason: "invalid_credential",
        dpopFailureReason: "key_mismatch",
        traceId: "trace-1",
      }),
    );

    expect(mapped.message).toBe(`The environment credential is invalid.\n\n${DPOP_RETRY_HINT}`);
  });
});

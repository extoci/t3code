import type { DpopFailureReason } from "@t3tools/contracts";
import type { RelayProtectedError } from "@t3tools/contracts/relay";

/**
 * A DPoP proof is checked against the clock on the receiving server. Older
 * servers do not report why they rejected a proof, so this hint is also the
 * compatibility fallback for those responses.
 */
export const DPOP_CLOCK_HINT =
  "Hint: Check the date and time on both devices, then try again.";

export const DPOP_RETRY_HINT =
  "Hint: Try again. If the problem continues, copy the trace ID.";

export function dpopFailureHint(reason: DpopFailureReason | undefined): string {
  return reason === undefined || reason === "time_window" ? DPOP_CLOCK_HINT : DPOP_RETRY_HINT;
}

export function relayProtectedErrorMessage(error: RelayProtectedError): string {
  switch (error._tag) {
    case "RelayAuthInvalidError":
      switch (error.reason) {
        case "missing_bearer":
        case "invalid_bearer":
          return "Relay rejected the cloud session token.";
        case "invalid_dpop":
          return `Relay rejected the DPoP proof.\n\n${dpopFailureHint(error.dpopFailureReason)}`;
        case "not_authorized":
          return "Relay rejected the authenticated request.";
      }
    case "RelayEnvironmentLinkProofExpiredError":
      return "Relay rejected an expired environment link proof.";
    case "RelayEnvironmentLinkProofInvalidError":
      return `Relay rejected the environment link proof (${error.reason}).`;
    case "RelayEnvironmentConnectNotAuthorizedError":
      // "Not authorized" covers non-auth causes too; surface the reason so a
      // missing link does not read as a credential problem.
      if (error.reason === "environment_link_not_found") {
        return "Relay has no active link for this environment. The environment server may not have re-established its link yet.";
      }
      return error.reason
        ? `Relay rejected the environment connection request (${error.reason}).`
        : "Relay rejected the environment connection request.";
    case "RelayEnvironmentEndpointUnavailableError":
      return `Relay could not reach the environment endpoint (${error.reason}).`;
    case "RelayEnvironmentEndpointTimedOutError":
      return "Relay timed out while contacting the environment endpoint.";
    case "RelayEnvironmentLinkFailedError":
      return `Relay could not link the environment (${error.reason}).`;
    case "RelayEnvironmentLinkUnavailableError":
      return `Relay cannot provision the managed endpoint (${error.reason}).`;
    case "RelayEnvironmentLinkLimitExceededError":
      return `Relay refused the link: this account already has its maximum of ${error.maxTunnels} managed tunnels. Unlink an environment to free one up.`;
    case "RelayAgentActivityPublishProofExpiredError":
      return "Relay rejected an expired agent activity publish proof.";
    case "RelayAgentActivityPublishProofInvalidError":
      return `Relay rejected the agent activity publish proof (${error.reason}).`;
    case "RelayInternalError":
      return `Relay encountered an internal error (${error.reason}).`;
  }
}

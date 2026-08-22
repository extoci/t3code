import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas.ts";
import { ProviderInstanceId } from "./providerInstance.ts";
import { ServerProviderSkill } from "./server.ts";

export const ProviderListSkillsInput = Schema.Struct({
  instanceId: ProviderInstanceId,
  cwd: TrimmedNonEmptyString,
});
export type ProviderListSkillsInput = typeof ProviderListSkillsInput.Type;

export const ProviderListSkillsResult = Schema.Struct({
  skills: Schema.Array(ServerProviderSkill),
  stale: Schema.Boolean,
});
export type ProviderListSkillsResult = typeof ProviderListSkillsResult.Type;

export const ProviderSkillDiscoveryErrorReason = Schema.Literals([
  "instanceNotFound",
  "instanceUnavailable",
  "invalidDirectory",
  "discoveryFailed",
]);
export type ProviderSkillDiscoveryErrorReason = typeof ProviderSkillDiscoveryErrorReason.Type;

export class ProviderSkillDiscoveryError extends Schema.TaggedErrorClass<ProviderSkillDiscoveryError>()(
  "ProviderSkillDiscoveryError",
  {
    reason: ProviderSkillDiscoveryErrorReason,
    message: TrimmedNonEmptyString,
  },
) {}

import {
  ProviderSkillDiscoveryError,
  type ProviderListSkillsResult,
  type ServerProviderSkill,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";

const DEFAULT_CACHE_CAPACITY = 64;

export interface ProviderSkillCatalog {
  readonly list: (
    cwd: string,
  ) => Effect.Effect<ProviderListSkillsResult, ProviderSkillDiscoveryError>;
}

export function providerSkillDiscoveryFailed(cause: unknown): ProviderSkillDiscoveryError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new ProviderSkillDiscoveryError({
    reason: "discoveryFailed",
    message:
      detail.trim().length > 0
        ? `Could not load provider skills: ${detail}`
        : "Could not load provider skills.",
  });
}

export function makeCachedProviderSkillCatalog(
  discover: (
    cwd: string,
  ) => Effect.Effect<ReadonlyArray<ServerProviderSkill>, ProviderSkillDiscoveryError>,
  capacity = DEFAULT_CACHE_CAPACITY,
): ProviderSkillCatalog {
  const lastSuccessful = new Map<string, ReadonlyArray<ServerProviderSkill>>();

  const remember = (cwd: string, skills: ReadonlyArray<ServerProviderSkill>) => {
    lastSuccessful.delete(cwd);
    lastSuccessful.set(cwd, skills);
    const oldest = lastSuccessful.keys().next().value as string | undefined;
    if (lastSuccessful.size > capacity && oldest !== undefined) {
      lastSuccessful.delete(oldest);
    }
  };

  const list = Effect.fn("ProviderSkillCatalog.list")(function* (cwd: string) {
    return yield* discover(cwd).pipe(
      Effect.matchEffect({
        onFailure: (error) => {
          const cached = lastSuccessful.get(cwd);
          return cached
            ? Effect.succeed({ skills: cached, stale: true } satisfies ProviderListSkillsResult)
            : Effect.fail(error);
        },
        onSuccess: (skills) =>
          Effect.sync(() => {
            remember(cwd, skills);
            return { skills, stale: false } satisfies ProviderListSkillsResult;
          }),
      }),
    );
  });

  return { list };
}

export const emptyProviderSkillCatalog: ProviderSkillCatalog = {
  list: () => Effect.succeed({ skills: [], stale: false }),
};

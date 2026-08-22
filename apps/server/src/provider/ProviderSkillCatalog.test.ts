import { assert, it } from "@effect/vitest";
import { ProviderSkillDiscoveryError, type ServerProviderSkill } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { makeCachedProviderSkillCatalog } from "./ProviderSkillCatalog.ts";

const skill = (name: string, cwd: string): ServerProviderSkill => ({
  name,
  path: `${cwd}/.agents/skills/${name}/SKILL.md`,
  enabled: true,
});

it.effect("keeps the last successful skill list separate for each directory", () =>
  Effect.gen(function* () {
    const failing = new Set<string>();
    const catalog = makeCachedProviderSkillCatalog((cwd) =>
      failing.has(cwd)
        ? Effect.fail(
            new ProviderSkillDiscoveryError({
              reason: "discoveryFailed",
              message: `Could not read ${cwd}.`,
            }),
          )
        : Effect.succeed([skill(cwd.endsWith("one") ? "one" : "two", cwd)]),
    );

    const first = yield* catalog.list("/workspace/one");
    const second = yield* catalog.list("/workspace/two");
    failing.add("/workspace/one");
    const stale = yield* catalog.list("/workspace/one");

    assert.deepStrictEqual(
      first.skills.map((entry) => entry.name),
      ["one"],
    );
    assert.deepStrictEqual(
      second.skills.map((entry) => entry.name),
      ["two"],
    );
    assert.deepStrictEqual(
      stale.skills.map((entry) => entry.name),
      ["one"],
    );
    assert.isFalse(first.stale);
    assert.isTrue(stale.stale);
  }),
);

it.effect("fails when discovery has no saved result", () =>
  Effect.gen(function* () {
    const catalog = makeCachedProviderSkillCatalog(() =>
      Effect.fail(
        new ProviderSkillDiscoveryError({
          reason: "discoveryFailed",
          message: "Discovery failed.",
        }),
      ),
    );

    const error = yield* Effect.flip(catalog.list("/workspace/missing"));
    assert.strictEqual(error.reason, "discoveryFailed");
  }),
);

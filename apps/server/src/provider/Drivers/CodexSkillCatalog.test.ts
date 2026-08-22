import { assert, it } from "@effect/vitest";
import type { ServerProviderSkill } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Result from "effect/Result";
import * as TestClock from "effect/testing/TestClock";

import {
  makeCodexSkillCatalogFromConnect,
  type CodexSkillCatalogConnect,
} from "./CodexSkillCatalog.ts";

const skill = (cwd: string): ServerProviderSkill => ({
  name: "test-t3-mobile",
  path: `${cwd}/.agents/skills/test-t3-mobile/SKILL.md`,
  enabled: true,
});

it.effect("reuses one Codex connection and closes it with the catalog scope", () =>
  Effect.gen(function* () {
    let connectCalls = 0;
    let closeCalls = 0;
    const connect: CodexSkillCatalogConnect = () =>
      Effect.sync(() => {
        connectCalls += 1;
        return {
          request: (cwd: string) => Effect.succeed([skill(cwd)]),
          close: Effect.sync(() => {
            closeCalls += 1;
          }),
        };
      });

    yield* Effect.scoped(
      Effect.gen(function* () {
        const catalog = yield* makeCodexSkillCatalogFromConnect(connect);
        const first = yield* catalog.list("/workspace/one");
        const second = yield* catalog.list("/workspace/two");

        assert.strictEqual(connectCalls, 1);
        assert.deepStrictEqual(
          first.skills.map((entry) => entry.name),
          ["test-t3-mobile"],
        );
        assert.deepStrictEqual(
          second.skills.map((entry) => entry.name),
          ["test-t3-mobile"],
        );
        assert.strictEqual(closeCalls, 0);
      }),
    );

    assert.strictEqual(closeCalls, 1);
  }),
);

it.effect("closes a timed-out connection before the next discovery", () =>
  Effect.gen(function* () {
    let connectCalls = 0;
    let closeCalls = 0;
    const connect: CodexSkillCatalogConnect = () =>
      Effect.sync(() => {
        connectCalls += 1;
        const connectionNumber = connectCalls;
        return {
          request: (cwd: string) =>
            connectionNumber === 1 ? Effect.never : Effect.succeed([skill(cwd)]),
          close: Effect.sync(() => {
            closeCalls += 1;
          }),
        };
      });

    yield* Effect.scoped(
      Effect.gen(function* () {
        const catalog = yield* makeCodexSkillCatalogFromConnect(connect);
        const timedOutFiber = yield* Effect.result(catalog.list("/workspace/project")).pipe(
          Effect.forkChild,
        );
        yield* Effect.yieldNow;
        yield* TestClock.adjust("10 seconds");

        const timedOut = yield* Fiber.join(timedOutFiber);
        assert.isTrue(Result.isFailure(timedOut));
        if (Result.isFailure(timedOut)) {
          assert.strictEqual(timedOut.failure.reason, "discoveryFailed");
        }
        assert.strictEqual(closeCalls, 1);

        const recovered = yield* catalog.list("/workspace/project");
        assert.strictEqual(connectCalls, 2);
        assert.deepStrictEqual(
          recovered.skills.map((entry) => entry.name),
          ["test-t3-mobile"],
        );
      }),
    );

    assert.strictEqual(closeCalls, 2);
  }),
);

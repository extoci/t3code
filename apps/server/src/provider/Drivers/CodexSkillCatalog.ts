import {
  ProviderSkillDiscoveryError,
  type CodexSettings,
  type ServerProviderSkill,
} from "@t3tools/contracts";
import { resolveSpawnCommand } from "@t3tools/shared/shell";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";
import * as CodexClient from "effect-codex-app-server/client";

import { expandHomePath } from "../../pathExpansion.ts";
import { codexAppServerArgs, resolveCodexLaunchArgs } from "../Layers/codexLaunchArgs.ts";
import {
  buildCodexInitializeParams,
  parseCodexSkillsListResponse,
} from "../Layers/CodexProvider.ts";
import {
  makeCachedProviderSkillCatalog,
  providerSkillDiscoveryFailed,
  type ProviderSkillCatalog,
} from "../ProviderSkillCatalog.ts";

const CODEX_SKILL_DISCOVERY_TIMEOUT = Duration.seconds(10);
const CODEX_SKILL_PROCESS_FORCE_KILL_AFTER = "2 seconds" as const;

export interface CodexSkillCatalogConnection {
  readonly request: (
    cwd: string,
  ) => Effect.Effect<ReadonlyArray<ServerProviderSkill>, ProviderSkillDiscoveryError>;
  readonly close: Effect.Effect<void>;
}

export type CodexSkillCatalogConnect = (
  cwd: string,
) => Effect.Effect<CodexSkillCatalogConnection, ProviderSkillDiscoveryError>;

/** @internal Test seam for the persistent connection lifecycle. */
export const makeCodexSkillCatalogFromConnect = Effect.fn("makeCodexSkillCatalogFromConnect")(
  function* (
    connect: CodexSkillCatalogConnect,
    timeout: Duration.Duration = CODEX_SKILL_DISCOVERY_TIMEOUT,
  ): Effect.fn.Return<ProviderSkillCatalog, never, Scope.Scope> {
    const connectionRef = yield* Ref.make<CodexSkillCatalogConnection | null>(null);
    const connectionSemaphore = yield* Semaphore.make(1);

    const closeConnection = Effect.fn("CodexSkillCatalog.closeConnection")(function* (
      connection: CodexSkillCatalogConnection,
    ) {
      const current = yield* Ref.get(connectionRef);
      if (current !== connection) return;
      yield* Ref.set(connectionRef, null);
      yield* connection.close;
    });

    yield* Effect.addFinalizer(() =>
      Ref.get(connectionRef).pipe(
        Effect.flatMap((connection) => (connection ? closeConnection(connection) : Effect.void)),
      ),
    );

    const getConnection = Effect.fn("CodexSkillCatalog.getConnection")(function* (cwd: string) {
      const current = yield* Ref.get(connectionRef);
      if (current) return current;
      const connection = yield* connect(cwd);
      yield* Ref.set(connectionRef, connection);
      return connection;
    });

    const discoverFresh = Effect.fn("CodexSkillCatalog.discoverFresh")(function* (cwd: string) {
      return yield* connectionSemaphore.withPermits(1)(
        Effect.gen(function* () {
          const firstConnection = yield* getConnection(cwd);
          const firstAttempt = yield* Effect.result(firstConnection.request(cwd));
          if (Result.isSuccess(firstAttempt)) {
            return firstAttempt.success;
          }

          yield* closeConnection(firstConnection);
          const retryConnection = yield* getConnection(cwd);
          return yield* retryConnection.request(cwd);
        }).pipe(
          Effect.timeoutOption(timeout),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Ref.get(connectionRef).pipe(
                  Effect.flatMap((connection) =>
                    connection ? closeConnection(connection) : Effect.void,
                  ),
                  Effect.andThen(
                    Effect.fail(providerSkillDiscoveryFailed("Codex skill discovery timed out.")),
                  ),
                ),
              onSome: Effect.succeed,
            }),
          ),
        ),
      );
    });

    return makeCachedProviderSkillCatalog(discoverFresh);
  },
);

export const makeCodexSkillCatalog = Effect.fn("makeCodexSkillCatalog")(function* (
  settings: CodexSettings,
  environment: NodeJS.ProcessEnv,
): Effect.fn.Return<
  ProviderSkillCatalog,
  never,
  ChildProcessSpawner.ChildProcessSpawner | Scope.Scope
> {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const resolvedHomePath = settings.homePath ? expandHomePath(settings.homePath) : undefined;
  const processEnvironment = {
    ...environment,
    ...(resolvedHomePath ? { CODEX_HOME: resolvedHomePath } : {}),
  };

  const connect = Effect.fn("CodexSkillCatalog.connect")(function* (cwd: string) {
    const connectionScope = yield* Scope.make("sequential");
    return yield* Effect.gen(function* () {
      const launchArgs = resolveCodexLaunchArgs(settings.launchArgs, processEnvironment);
      const spawnCommand = yield* resolveSpawnCommand(
        settings.binaryPath,
        codexAppServerArgs(launchArgs),
        {
          env: processEnvironment,
          extendEnv: true,
        },
      );
      const child = yield* spawner.spawn(
        ChildProcess.make(spawnCommand.command, spawnCommand.args, {
          cwd,
          env: processEnvironment,
          extendEnv: true,
          forceKillAfter: CODEX_SKILL_PROCESS_FORCE_KILL_AFTER,
          shell: spawnCommand.shell,
        }),
      );
      const clientContext = yield* Layer.build(CodexClient.layerChildProcess(child));
      const client = yield* Effect.service(CodexClient.CodexAppServerClient).pipe(
        Effect.provide(clientContext),
      );
      yield* client.request("initialize", buildCodexInitializeParams());
      yield* client.notify("initialized", undefined);
      return {
        request: (requestedCwd: string) =>
          client.request("skills/list", { cwds: [requestedCwd] }).pipe(
            Effect.map((response) => parseCodexSkillsListResponse(response, requestedCwd)),
            Effect.mapError(providerSkillDiscoveryFailed),
          ),
        close: Scope.close(connectionScope, Exit.void).pipe(Effect.ignore),
      } satisfies CodexSkillCatalogConnection;
    }).pipe(
      Effect.provideService(Scope.Scope, connectionScope),
      Effect.onError(() => Scope.close(connectionScope, Exit.void).pipe(Effect.ignore)),
      Effect.mapError(providerSkillDiscoveryFailed),
    );
  });

  return yield* makeCodexSkillCatalogFromConnect(connect);
});

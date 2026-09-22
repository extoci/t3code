import { DEFAULT_SERVER_SETTINGS, EnvironmentId, ThreadId } from "@t3tools/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useThreadActions } from "./useThreadActions";
import { threadEnvironment } from "../state/threads";
import { toastManager } from "../components/ui/toast";
import { undoLatestThreadAction } from "./showUndoToast";
import { appAtomRegistry } from "../rpc/atomRegistry";
import { environmentServerConfigsAtom, primaryServerKeybindingsAtom } from "../state/server";

const commands = vi.hoisted(() => ({
  pin: vi.fn(),
  unpin: vi.fn(),
  archive: vi.fn(),
  unarchive: vi.fn(),
  settle: vi.fn(),
  unsettle: vi.fn(),
  snooze: vi.fn(),
  unsnooze: vi.fn(),
}));
const router = vi.hoisted(() => ({
  navigate: vi.fn(async () => {}),
  state: { matches: [{ params: {} as Record<string, string> }] },
}));
const firstUseHints = vi.hoisted(() => ({ show: vi.fn() }));
const atomRegistry = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useCallback: (callback: unknown) => callback,
  useMemo: (create: () => unknown) => create(),
  useRef: (value: unknown) => ({ current: value }),
}));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => router }));
vi.mock("./useSettings", () => ({ useClientSettings: () => false }));
vi.mock("./useHandleNewThread", () => ({ useNewThreadHandler: () => vi.fn() }));
vi.mock("../composerDraftStore", () => ({ useComposerDraftStore: () => vi.fn() }));
vi.mock("../terminalUiStateStore", () => ({ useTerminalUiStateStore: () => vi.fn() }));
vi.mock("../uiStateStore", () => ({ useUiStateStore: () => vi.fn() }));
vi.mock("../firstUseHints", () => ({ firstUseHints }));
vi.mock("../rpc/atomRegistry", () => ({ appAtomRegistry: atomRegistry }));
vi.mock("../lib/archivedThreadsState", () => ({ refreshArchivedThreadsForEnvironment: vi.fn() }));
const threadShell = vi.hoisted(() => ({
  title: "Thread",
  pinOrderKey: "a0",
  pinnedAt: null as string | null,
  snoozedUntil: null as string | null,
  projectId: "project",
  environmentId: "undo-env",
  session: null,
  worktreePath: null as string | null,
}));
vi.mock("../state/entities", async (original) => ({
  ...(await original<typeof import("../state/entities")>()),
  readEnvironmentSupportsPinning: () => true,
  readEnvironmentSupportsPinReorder: () => true,
  readEnvironmentSupportsSettlement: () => true,
  readEnvironmentSupportsSnooze: () => true,
  readThreadShell: () => threadShell,
}));
vi.mock("../state/use-atom-command", () => ({
  useAtomCommand: (command: unknown) => {
    switch (command) {
      case threadEnvironment.pin:
        return commands.pin;
      case threadEnvironment.unpin:
        return commands.unpin;
      case threadEnvironment.archive:
        return commands.archive;
      case threadEnvironment.unarchive:
        return commands.unarchive;
      case threadEnvironment.settle:
        return commands.settle;
      case threadEnvironment.unsettle:
        return commands.unsettle;
      case threadEnvironment.snooze:
        return commands.snooze;
      case threadEnvironment.unsnooze:
        return commands.unsnooze;
      default:
        return vi.fn();
    }
  },
}));

const target = {
  environmentId: EnvironmentId.make("undo-env"),
  threadId: ThreadId.make("thread"),
};
const event = {} as Parameters<NonNullable<React.ComponentProps<"button">["onClick"]>>[0];

function undoOf(
  add: { mock: { calls: Array<[Parameters<typeof toastManager.add>[0]]> } },
  index: number,
) {
  const onClick = add.mock.calls[index]?.[0].actionProps?.onClick;
  expect(onClick).toBeTypeOf("function");
  return () => onClick?.(event);
}

beforeEach(() => {
  for (const command of Object.values(commands)) {
    command.mockReset().mockResolvedValue({ _tag: "Success", value: undefined });
  }
  router.navigate.mockClear();
  router.state.matches[0]!.params = {};
  threadShell.pinnedAt = null;
  threadShell.snoozedUntil = null;
  threadShell.worktreePath = null;
  firstUseHints.show.mockReset().mockReturnValue(false);
  vi.mocked(appAtomRegistry.get)
    .mockReset()
    .mockImplementation((atom) => {
      if (atom === environmentServerConfigsAtom) return new Map() as never;
      if (atom === primaryServerKeybindingsAtom) return [] as never;
      throw new Error("Unexpected atom read");
    });
});
afterEach(() => vi.restoreAllMocks());

describe("unpin Undo", () => {
  it("ignores an old toast across hook instances and still restores the latest unpin", async () => {
    const add = vi.spyOn(toastManager, "add").mockReturnValue("toast");
    vi.spyOn(toastManager, "close").mockImplementation(() => {});
    const sidebar = useThreadActions();
    const header = useThreadActions();
    await sidebar.unpinThread(target);
    const staleUndo = undoOf(add, 0);
    await header.pinThread(target, { orderKey: "a1" });
    await header.unpinThread(target);
    const latestUndo = undoOf(add, 1);
    await staleUndo();
    expect(commands.pin).toHaveBeenCalledTimes(1);
    await latestUndo();
    expect(commands.pin).toHaveBeenCalledTimes(2);
    expect(commands.pin).toHaveBeenLastCalledWith({
      environmentId: target.environmentId,
      input: { threadId: target.threadId, orderKey: "a0" },
    });
    await latestUndo();
    expect(commands.pin).toHaveBeenCalledTimes(2);
  });
});

describe("archive Undo", () => {
  it("unarchives and returns to the thread when archiving left it", async () => {
    const add = vi.spyOn(toastManager, "add").mockReturnValue("toast");
    vi.spyOn(toastManager, "close").mockImplementation(() => {});
    router.state.matches[0]!.params = {
      environmentId: target.environmentId,
      threadId: target.threadId,
    };
    const actions = useThreadActions();
    await actions.archiveThread(target);
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: "Thread archived" }));
    await undoOf(add, 0)();
    expect(commands.unarchive).toHaveBeenCalledExactlyOnceWith({
      environmentId: target.environmentId,
      input: { threadId: target.threadId },
    });
    expect(router.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/$environmentId/$threadId",
        params: { environmentId: target.environmentId, threadId: target.threadId },
      }),
    );
  });

  it("stays put when the archived thread was not open", async () => {
    const add = vi.spyOn(toastManager, "add").mockReturnValue("toast");
    vi.spyOn(toastManager, "close").mockImplementation(() => {});
    const actions = useThreadActions();
    await actions.archiveThread(target);
    await undoOf(add, 0)();
    expect(commands.unarchive).toHaveBeenCalledOnce();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("shows no Undo when the archive failed", async () => {
    commands.archive.mockResolvedValue({ _tag: "Failure", cause: new Error("nope") });
    const add = vi.spyOn(toastManager, "add").mockReturnValue("toast");
    await useThreadActions().archiveThread(target);
    expect(add).not.toHaveBeenCalled();
  });
});

describe("settle and snooze Undo", () => {
  it("registers settle Undo without presenting a toast", async () => {
    const add = vi.spyOn(toastManager, "add").mockReturnValue("toast");
    const actions = useThreadActions();
    await actions.settleThread(target);

    expect(add).not.toHaveBeenCalled();
    expect(undoLatestThreadAction()).toBe(true);
    await vi.waitFor(() => expect(commands.unsettle).toHaveBeenCalledOnce());
  });

  it("expires settle Undo after a manual un-settle", async () => {
    const actions = useThreadActions();
    await actions.settleThread(target);
    await actions.unsettleThread(target);

    expect(undoLatestThreadAction()).toBe(false);
    expect(commands.unsettle).toHaveBeenCalledOnce();
  });

  it("re-pins and re-snoozes a thread that settling had cleared", async () => {
    const add = vi.spyOn(toastManager, "add").mockReturnValue("toast");
    vi.spyOn(toastManager, "close").mockImplementation(() => {});
    const snoozedUntil = "2030-01-01T09:00:00.000Z";
    threadShell.pinnedAt = "2026-01-01T00:00:00.000Z";
    threadShell.snoozedUntil = snoozedUntil;
    const actions = useThreadActions();
    await actions.settleThread(target);
    expect(add).not.toHaveBeenCalled();
    expect(undoLatestThreadAction()).toBe(true);
    await vi.waitFor(() => expect(commands.snooze).toHaveBeenCalledOnce());
    expect(commands.unsettle).toHaveBeenCalledOnce();
    expect(commands.pin).toHaveBeenCalledExactlyOnceWith({
      environmentId: target.environmentId,
      input: { threadId: target.threadId, orderKey: "a0" },
    });
    expect(commands.snooze).toHaveBeenCalledExactlyOnceWith({
      environmentId: target.environmentId,
      input: { threadId: target.threadId, snoozedUntil },
    });
  });

  it("expires an older unpin Undo when the thread is settled", async () => {
    const add = vi.spyOn(toastManager, "add").mockReturnValue("toast");
    vi.spyOn(toastManager, "close").mockImplementation(() => {});
    const actions = useThreadActions();
    await actions.unpinThread(target);
    const staleUnpinUndo = undoOf(add, 0);
    await actions.settleThread(target);
    await staleUnpinUndo();
    expect(commands.pin).not.toHaveBeenCalled();
  });

  it("stays silent for batch settles", async () => {
    const add = vi.spyOn(toastManager, "add").mockReturnValue("toast");
    await useThreadActions().settleThread(target, { undoToast: false });
    expect(add).not.toHaveBeenCalled();
    expect(firstUseHints.show).not.toHaveBeenCalled();
  });

  it("offers the first-use hint until it is dismissed", async () => {
    firstUseHints.show.mockReturnValueOnce(true);
    const actions = useThreadActions();
    await actions.settleThread(target);

    expect(firstUseHints.show).toHaveBeenCalledOnce();
    const hint = firstUseHints.show.mock.calls[0]?.[0];
    expect(hint).toMatchObject({
      id: "thread-settle",
      title: "Thread settled",
      secondaryAction: { label: "Undo settle" },
    });
    expect(hint.description).toMatch(/undo this settle/i);
    hint.secondaryAction.onSelect();
    hint.onDismiss();
    await vi.waitFor(() => expect(commands.unsettle).toHaveBeenCalledOnce());
  });

  it("suggests worktree cleanup when every effective rule is off", async () => {
    threadShell.worktreePath = "/repo/.worktrees/thread";
    vi.mocked(appAtomRegistry.get).mockImplementation((atom) => {
      if (atom === environmentServerConfigsAtom) {
        return new Map([
          [
            target.environmentId,
            {
              environment: { capabilities: { storageCleanup: true } },
              settings: DEFAULT_SERVER_SETTINGS,
            },
          ],
        ]) as never;
      }
      if (atom === primaryServerKeybindingsAtom) return [] as never;
      throw new Error("Unexpected atom read");
    });
    firstUseHints.show.mockReturnValueOnce(true);

    await useThreadActions().settleThread(target);

    const hint = firstUseHints.show.mock.calls[0]?.[0];
    expect(hint.description).toMatch(/automatically clean up/i);
    expect(hint.primaryAction?.label).toBe("Worktree settings");
    hint.primaryAction?.onSelect();
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith({
      to: "/settings/storage",
      search: { machine: target.environmentId },
      hash: "storage-worktrees",
    });
    hint.onDismiss();
  });

  it("wakes the thread from the snooze toast", async () => {
    const add = vi.spyOn(toastManager, "add").mockReturnValue("toast");
    vi.spyOn(toastManager, "close").mockImplementation(() => {});
    const actions = useThreadActions();
    await actions.snoozeThread(target, new Date(Date.now() + 60_000).toISOString());
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/^Snoozed until /) }),
    );
    await undoOf(add, 0)();
    expect(commands.unsnooze).toHaveBeenCalledExactlyOnceWith({
      environmentId: target.environmentId,
      input: { threadId: target.threadId, reason: "user" },
    });
  });
});

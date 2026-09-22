import {
  type AtomCommandResult,
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";

import { stackedThreadToast, toastManager } from "../components/ui/toast";
import type * as ThreadUndo from "./threadUndo";

export const THREAD_UNDO_TIMEOUT_MS = 5_000;

export type RegisteredThreadUndo = {
  readonly run: () => Promise<void> | null;
  readonly finish: () => void;
};

type RegisterThreadUndoOptions = {
  readonly undo: () => Promise<AtomCommandResult<unknown, unknown>>;
  readonly failureTitle: string;
  readonly claim: ReturnType<typeof ThreadUndo.begin>;
  readonly expiresAfterMs?: number;
};

// Live Undos, oldest first. Most have a toast, but presentation is optional so
// a learned `thread.undo` shortcut does not require a notification every time.
const liveUndos: RegisteredThreadUndo[] = [];

/** Runs the newest Undo whose claim still holds; false when nothing is left to undo. */
export function undoLatestThreadAction(): boolean {
  // A superseded entry drops itself when tried, so keep going until one
  // runs or the list is empty.
  while (liveUndos.length > 0) {
    if (liveUndos[liveUndos.length - 1]?.run() !== null) return true;
  }
  return false;
}

/** Registers a single-use Undo while its thread action still owns the claim. */
export function registerThreadUndo({
  undo,
  failureTitle,
  claim,
  expiresAfterMs,
}: RegisterThreadUndoOptions): RegisteredThreadUndo | null {
  if (!claim.isCurrent()) return null;
  let undoStarted = false;
  let expiration: ReturnType<typeof setTimeout> | undefined;
  const reportFailure = (error: unknown) => {
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title: failureTitle,
        description: error instanceof Error ? error.message : "An error occurred.",
      }),
    );
  };
  const forget = () => {
    const index = liveUndos.indexOf(registration);
    if (index !== -1) liveUndos.splice(index, 1);
  };
  const clearExpiration = () => {
    if (expiration === undefined) return;
    clearTimeout(expiration);
    expiration = undefined;
  };
  const finish = () => {
    forget();
    clearExpiration();
    claim.finish();
  };
  const run = () => {
    forget();
    clearExpiration();
    if (undoStarted || !claim.isCurrent()) return null;
    undoStarted = true;
    claim.finish();
    return undo()
      .then((result) => {
        if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
          reportFailure(squashAtomCommandFailure(result));
        }
      })
      .catch(reportFailure);
  };
  const registration: RegisteredThreadUndo = { run, finish };
  liveUndos.push(registration);
  if (expiresAfterMs !== undefined) {
    expiration = setTimeout(finish, expiresAfterMs);
  }
  return registration;
}

/** Shows a registered Undo while its thread action still owns the claim. */
export function showUndoToast({
  title,
  description,
  ...options
}: Omit<RegisterThreadUndoOptions, "expiresAfterMs"> & {
  title: string;
  description: string | undefined;
}) {
  let toastId: string | undefined;
  const registration = registerThreadUndo(options);
  if (registration === null) return;
  toastId = toastManager.add({
    ...stackedThreadToast({
      type: "success",
      title,
      description,
      timeout: THREAD_UNDO_TIMEOUT_MS,
      actionProps: {
        children: "Undo",
        onClick: async () => {
          const result = registration.run();
          if (result === null) return;
          if (toastId !== undefined) toastManager.close(toastId);
          await result;
        },
      },
    }),
    onClose: registration.finish,
  });
}

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { reactHookHarness as hooks } from "../test/reactHookHarness";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const { reactHookHarness } = await import("../test/reactHookHarness");
  return {
    ...actual,
    useCallback: reactHookHarness.useCallback,
    useRef: reactHookHarness.useRef,
    useState: reactHookHarness.useState,
  };
});

vi.mock("react/compiler-runtime", async () => {
  const { reactHookHarness } = await import("../test/reactHookHarness");
  return { c: reactHookHarness.useMemoCache };
});

import * as Schema from "effect/Schema";

import { getLocalStorageItem, removeLocalStorageItem } from "./useLocalStorage";
import { useResizableWidth } from "./useResizableWidth";

const STORAGE_KEY = "test:resizable-width";

describe("useResizableWidth", () => {
  beforeEach(() => {
    hooks.reset();
    removeLocalStorageItem(STORAGE_KEY);
    vi.stubGlobal("document", {
      body: {
        style: {
          cursor: "",
          userSelect: "",
          removeProperty: vi.fn(),
        },
      },
    });
  });

  it("resets a resized panel to its default width", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const render = () => {
      hooks.beginRender();
      return useResizableWidth({
        storageKey: STORAGE_KEY,
        defaultWidth: 352,
        minWidth: 256,
        maxWidth: 560,
        edge: "left",
      });
    };
    const target = {
      hasPointerCapture: () => true,
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    };
    const event = (clientX: number) =>
      ({
        button: 0,
        clientX,
        currentTarget: target,
        pointerId: 1,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }) as never;

    let resizable = render();
    resizable.handlers.onPointerDown(event(100));
    resizable.handlers.onPointerMove(event(50));
    frames[0]?.(0);
    resizable.handlers.onPointerUp(event(50));

    resizable = render();
    expect(resizable.width).toBe(402);
    expect(getLocalStorageItem(STORAGE_KEY, Schema.Finite)).toBe(402);

    resizable.resetWidth();
    resizable = render();
    expect(resizable.width).toBe(352);
    expect(getLocalStorageItem(STORAGE_KEY, Schema.Finite)).toBeNull();
  });
});

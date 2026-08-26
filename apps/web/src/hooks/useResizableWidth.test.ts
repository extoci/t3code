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

import { removeLocalStorageItem } from "./useLocalStorage";
import { useResizableWidth } from "./useResizableWidth";

const STORAGE_KEY = "test:resizable-width";

function render(maxWidth: number) {
  hooks.beginRender();
  return useResizableWidth({
    storageKey: STORAGE_KEY,
    defaultWidth: 256,
    minWidth: 160,
    maxWidth,
    edge: "left",
  });
}

describe("useResizableWidth", () => {
  beforeEach(() => {
    hooks.reset();
    removeLocalStorageItem(STORAGE_KEY);
  });

  it("restores the default after a temporary width clamp", () => {
    const resizable = render(160);
    resizable.resetWidth();

    expect(render(160).width).toBe(160);
    expect(render(700).width).toBe(256);
  });
});

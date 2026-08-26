import { describe, expect, it } from "vite-plus/test";

import { getFileExplorerWidthLimits } from "./fileExplorerWidth";

describe("getFileExplorerWidthLimits", () => {
  it("keeps persisted widths before the container is measured", () => {
    expect(getFileExplorerWidthLimits()).toEqual({
      minWidth: 160,
      maxWidth: Number.POSITIVE_INFINITY,
    });
  });

  it("caps the explorer at 70% when the row is wide enough", () => {
    expect(getFileExplorerWidthLimits(1_000)).toEqual({ minWidth: 160, maxWidth: 700 });
  });

  it("reserves 256px for file content", () => {
    expect(getFileExplorerWidthLimits(600)).toEqual({ minWidth: 160, maxWidth: 344 });
  });

  it("keeps the explorer visible when both columns cannot fit", () => {
    expect(getFileExplorerWidthLimits(400)).toEqual({ minWidth: 160, maxWidth: 160 });
  });
});

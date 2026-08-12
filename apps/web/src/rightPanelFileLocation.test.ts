import { describe, expect, it } from "vite-plus/test";

import {
  fileSurfacePathForLocation,
  resolveRightPanelFileLocation,
} from "./rightPanelFileLocation";

describe("resolveRightPanelFileLocation", () => {
  it("makes absolute workspace files relative to the project", () => {
    expect(
      resolveRightPanelFileLocation("/workspace/t3code", "/workspace/t3code/docs/guide.md"),
    ).toEqual({
      cwd: "/workspace/t3code",
      relativePath: "docs/guide.md",
      rootLabel: null,
      workspaceRelative: true,
    });
  });

  it("roots a personal skill preview at its skill directory", () => {
    const location = resolveRightPanelFileLocation(
      "/workspace/t3code",
      "/Users/test/.codex/skills/review-follow-up/SKILL.md",
    );

    expect(location).toEqual({
      cwd: "/Users/test/.codex/skills/review-follow-up",
      relativePath: "SKILL.md",
      rootLabel: "review-follow-up",
      workspaceRelative: false,
    });
    expect(fileSurfacePathForLocation(location, "references/checklist.md")).toBe(
      "/Users/test/.codex/skills/review-follow-up/references/checklist.md",
    );
  });

  it("preserves Windows path semantics for a remote environment", () => {
    const location = resolveRightPanelFileLocation(
      "C:\\work\\t3code",
      "C:\\Users\\test\\.codex\\skills\\review-follow-up\\SKILL.md",
    );

    expect(location).toEqual({
      cwd: "C:\\Users\\test\\.codex\\skills\\review-follow-up",
      relativePath: "SKILL.md",
      rootLabel: "review-follow-up",
      workspaceRelative: false,
    });
    expect(fileSurfacePathForLocation(location, "references/checklist.md")).toBe(
      "C:\\Users\\test\\.codex\\skills\\review-follow-up\\references\\checklist.md",
    );
  });
});

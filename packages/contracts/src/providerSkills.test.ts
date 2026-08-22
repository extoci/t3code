import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import {
  ProviderListSkillsInput,
  ProviderListSkillsResult,
  ProviderSkillDiscoveryError,
} from "./providerSkills.ts";

const decodeProviderListSkillsInput = Schema.decodeUnknownSync(ProviderListSkillsInput);
const decodeProviderListSkillsResult = Schema.decodeUnknownSync(ProviderListSkillsResult);
const decodeProviderSkillDiscoveryError = Schema.decodeUnknownSync(ProviderSkillDiscoveryError);

describe("provider skill contracts", () => {
  it("decodes a project-aware skill result", () => {
    const input = decodeProviderListSkillsInput({
      instanceId: "codex_work",
      cwd: "/workspace/project",
    });
    const result = decodeProviderListSkillsResult({
      skills: [
        {
          name: "review",
          path: "/workspace/project/.agents/skills/review/SKILL.md",
          enabled: true,
        },
      ],
      stale: false,
    });

    expect(input.cwd).toBe("/workspace/project");
    expect(result.skills[0]?.name).toBe("review");
  });

  it("keeps discovery failure reasons on one tagged error", () => {
    const error = decodeProviderSkillDiscoveryError({
      _tag: "ProviderSkillDiscoveryError",
      reason: "instanceUnavailable",
      message: "Provider instance codex_work is disabled.",
    });

    expect(error.reason).toBe("instanceUnavailable");
  });
});

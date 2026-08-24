import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import type { ScopedThreadRef, ServerProviderSkill } from "@t3tools/contracts";
import { formatProviderSkillDisplayName } from "@t3tools/client-runtime/providerSkills";

import {
  CHAT_INLINE_CHIP_LABEL_CLASS_NAME,
  CHAT_INLINE_SKILL_CHIP_CLASS_NAME,
  COMPOSER_INLINE_CHIP_ICON_CLASS_NAME,
  SKILL_CHIP_ICON_SVG,
} from "../composerInlineChip";
import { cn } from "~/lib/utils";
import { useRightPanelStore, type RightPanelFileRoot } from "~/rightPanelStore";
import { resolvePathLinkTarget } from "~/terminal-links";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

const SKILL_TOKEN_REGEX = /(^|\s)\$([a-zA-Z][a-zA-Z0-9:_-]*)(?=\s|$)/g;

type InlineSkill = Pick<ServerProviderSkill, "name" | "displayName" | "path">;

interface SkillInlineTextProps {
  text: string;
  skills: ReadonlyArray<InlineSkill>;
  threadRef?: ScopedThreadRef | undefined;
  cwd?: string | undefined;
}

export function SkillInlineText(props: SkillInlineTextProps) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of props.text.matchAll(SKILL_TOKEN_REGEX)) {
    const prefix = match[1] ?? "";
    const name = match[2] ?? "";
    const start = (match.index ?? 0) + prefix.length;
    const rawText = `$${name}`;
    const skill = props.skills.find((candidate) => candidate.name === name);
    if (!skill) {
      continue;
    }

    if (start > cursor) {
      nodes.push(props.text.slice(cursor, start));
    }
    nodes.push(
      <SkillChip
        key={`${start}:${name}`}
        skill={skill}
        rawText={rawText}
        threadRef={props.threadRef}
        cwd={props.cwd}
      />,
    );
    cursor = start + rawText.length;
  }

  if (cursor === 0) {
    return <>{props.text}</>;
  }
  if (cursor < props.text.length) {
    nodes.push(props.text.slice(cursor));
  }
  return <>{nodes}</>;
}

export function renderSkillInlineMarkdownChildren(
  children: ReactNode,
  skills: ReadonlyArray<InlineSkill>,
  threadRef?: ScopedThreadRef,
  cwd?: string,
): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return <SkillInlineText text={child} skills={skills} threadRef={threadRef} cwd={cwd} />;
    }
    if (!isValidElement<{ children?: ReactNode; node?: { tagName?: string } }>(child)) {
      return child;
    }
    // Custom react-markdown components replace the intrinsic type, so also
    // check the hast node they carry.
    const markdownTagName = typeof child.type === "string" ? child.type : child.props.node?.tagName;
    if (markdownTagName === "code" || markdownTagName === "a") {
      return child;
    }
    if (!("children" in child.props)) {
      return child;
    }
    return cloneElement(
      child,
      undefined,
      renderSkillInlineMarkdownChildren(child.props.children, skills, threadRef, cwd),
    );
  });
}

function resolveSkillFileRoot(
  path: string,
  cwd: string | undefined,
  label: string,
): { relativePath: string; root: RightPanelFileRoot } | null {
  const absolutePath = cwd ? resolvePathLinkTarget(path, cwd) : path;
  const separatorIndex = Math.max(absolutePath.lastIndexOf("/"), absolutePath.lastIndexOf("\\"));
  if (separatorIndex < 0 || separatorIndex === absolutePath.length - 1) return null;

  const separator = absolutePath[separatorIndex] ?? "/";
  const rootEnd =
    separatorIndex === 0 || (separatorIndex === 2 && /^[a-zA-Z]:/.test(absolutePath))
      ? separatorIndex + 1
      : separatorIndex;
  return {
    relativePath: absolutePath.slice(separatorIndex + 1),
    root: {
      cwd: absolutePath.slice(0, rootEnd) || separator,
      label,
    },
  };
}

function SkillChip(props: {
  skill: InlineSkill;
  rawText: string;
  threadRef?: ScopedThreadRef | undefined;
  cwd?: string | undefined;
}) {
  const label = formatProviderSkillDisplayName(props.skill);
  const file = resolveSkillFileRoot(props.skill.path, props.cwd, label);
  const threadRef = props.threadRef;
  const openSkill =
    threadRef && file
      ? () =>
          useRightPanelStore
            .getState()
            .openFile(threadRef, file.relativePath, undefined, file.root, label)
      : undefined;
  const content = (
    <>
      <span
        aria-hidden="true"
        className={COMPOSER_INLINE_CHIP_ICON_CLASS_NAME}
        dangerouslySetInnerHTML={{ __html: SKILL_CHIP_ICON_SVG }}
      />
      <span className={CHAT_INLINE_CHIP_LABEL_CLASS_NAME}>{label}</span>
    </>
  );

  const chip = openSkill ? (
    <button
      type="button"
      className={cn(
        CHAT_INLINE_SKILL_CHIP_CLASS_NAME,
        "cursor-pointer transition-colors hover:bg-fuchsia-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      data-markdown-copy={props.rawText}
      aria-label={`Open ${label} skill file`}
      onClick={openSkill}
    >
      {content}
    </button>
  ) : (
    <span className={CHAT_INLINE_SKILL_CHIP_CLASS_NAME} data-markdown-copy={props.rawText}>
      {content}
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger render={chip} />
      <TooltipPopup side="top" className="max-w-sm break-all font-mono">
        {props.skill.path}
      </TooltipPopup>
    </Tooltip>
  );
}

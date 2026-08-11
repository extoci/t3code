import { describe, expect, it } from "vite-plus/test";

import { visitElements } from "~/test/reactElementTree";

import { MenuPopup } from "./menu";
import { TooltipPopup } from "./tooltip";

function zIndexFor(node: unknown, slot: string): number {
  const element = visitElements(node, (candidate) => candidate.props["data-slot"] === slot);
  const className = String(element?.props.className ?? "");
  const match = className.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?:\s|$)/u);
  return Number(match?.[1] ?? match?.[2]);
}

describe("overlay layers", () => {
  it("renders tooltips above menus so nested help text stays visible", () => {
    const menuLayer = zIndexFor(MenuPopup({ children: "Menu" }), "menu-positioner");
    const tooltipLayer = zIndexFor(TooltipPopup({ children: "Tooltip" }), "tooltip-positioner");

    expect(tooltipLayer).toBeGreaterThan(menuLayer);
  });
});

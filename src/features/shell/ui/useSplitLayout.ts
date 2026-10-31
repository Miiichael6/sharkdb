import type { CSSProperties, RefObject } from "react";
import { useElementWidth } from "../../../shared/ui/useElementWidth";
import { DEFAULT_SPLIT_RATIO, SPLIT_MIN_WIDTH_PX } from "../domain/splitTabs";
import type { Split } from "../domain/tabs";

export interface PaneLayout {
  shown: boolean;
  /** Shown as the active pane of a split (marked as such). */
  activePane: boolean;
  style?: CSSProperties;
}

/** Flex order of the divider; the left pane goes before it and the right one after. */
const DIVIDER_ORDER = 1;

/**
 * Where each shell tab goes in the shell area. Every tab stays mounted in one flat list (so splitting
 * or separating never loses its editor or results) and a shown split places its panes with flex
 * order around the divider. Narrower than SPLIT_MIN_WIDTH_PX only the active pane shows.
 */
export function useSplitLayout(area: RefObject<HTMLElement | null>, activeId: string | undefined, split: Split | undefined) {
  const width = useElementWidth(area);
  const wide = width >= SPLIT_MIN_WIDTH_PX;
  const shownSplit = wide ? split : undefined;

  const pane = (id: string): PaneLayout => {
    if (!shownSplit) return { shown: id === activeId, activePane: false };
    if (id === shownSplit.left)
      return { shown: true, activePane: id === activeId, style: { order: DIVIDER_ORDER - 1, flex: `0 0 ${shownSplit.ratio * 100}%` } };
    if (id === shownSplit.right) return { shown: true, activePane: id === activeId, style: { order: DIVIDER_ORDER + 1 } };
    return { shown: false, activePane: false };
  };

  return {
    /** Split shown side by side, if any. */
    shownSplit,
    /** Tabs can be dropped on the area to split it. */
    canSplit: wide,
    /** Where the divider is, or would be once split. */
    ratio: shownSplit?.ratio ?? DEFAULT_SPLIT_RATIO,
    dividerOrder: DIVIDER_ORDER,
    pane,
  };
}

// Split tabs, as in file-manager: two shell tabs side by side that the bar shows as one entry. Each
// pane keeps its own tab id (and so its own runtime), so both can run at the same time.
import {
  activateTab,
  fromGroups,
  openTab,
  splitOf,
  tabGroups,
  type NewTab,
  type ShellTab,
  type Side,
  type Split,
  type TabsState,
} from "./tabs";

export const DEFAULT_SPLIT_RATIO = 0.5;
/** Narrower than this, a split shows only its active pane. */
export const SPLIT_MIN_WIDTH_PX = 640;
/** Narrowest a pane can be dragged to. */
export const MIN_PANE_WIDTH_PX = 260;

/** One entry of the bar: a tab, or a split with its two panes (left, right). */
export interface BarEntry {
  /** The tab's id; on a split, its left pane's. */
  id: string;
  panes: ShellTab[];
  activePane: Side;
  split?: Split;
}

const paneIds = (split: Split): [string, string] => [split.left, split.right];

export function barEntries(state: TabsState): BarEntry[] {
  return tabGroups(state).map((ids) => {
    const split = splitOf(state, ids[0]);
    const panes = ids.map((id) => state.tabs.find((t) => t.id === id)!);
    return { id: ids[0], panes, activePane: split?.activePane ?? 0, split };
  });
}

/** Bar entry holding the active tab. */
export const activeEntryId = (state: TabsState): string | null =>
  state.activeId === null ? null : (splitOf(state, state.activeId)?.left ?? state.activeId);

/** Activates a bar entry: a split comes back to the pane that was active in it. */
export function activateEntry(state: TabsState, id: string): TabsState {
  const split = splitOf(state, id);
  return activateTab(state, split ? paneIds(split)[split.activePane] : id);
}

/**
 * Shows the entry `draggedId` belongs to on `side` of the active one, which becomes (or stays) a
 * split. A dragged split brings only its active pane; its other pane, and the pane it displaces on
 * an active split, stay as plain tabs where the dragged entry was.
 */
export function splitWithTab(state: TabsState, draggedId: string, side: Side): TabsState {
  if (state.activeId === null) return state;
  const groups = tabGroups(state);
  const target = groups.find((g) => g.includes(state.activeId!));
  const dragged = groups.find((g) => g.includes(draggedId));
  if (!target || !dragged || target === dragged) return state;

  const draggedSplit = splitOf(state, draggedId);
  const incoming = draggedSplit ? paneIds(draggedSplit)[draggedSplit.activePane] : draggedId;
  const targetSplit = splitOf(state, state.activeId);
  const kept = targetSplit ? paneIds(targetSplit)[side === 0 ? 1 : 0] : state.activeId;
  const leftovers = [...dragged.filter((id) => id !== incoming), ...target.filter((id) => id !== kept)];

  const split: Split = {
    left: side === 0 ? incoming : kept,
    right: side === 0 ? kept : incoming,
    activePane: side,
    ratio: targetSplit?.ratio ?? DEFAULT_SPLIT_RATIO,
  };
  const next = groups.flatMap((g) =>
    g === target ? [[split.left, split.right]] : g === dragged ? leftovers.map((id) => [id]) : [g],
  );
  return {
    tabs: fromGroups(state, next),
    splits: [...state.splits.filter((s) => s !== targetSplit && s !== draggedSplit), split],
    activeId: incoming,
  };
}

/** Opens a new tab `id` on `side` of the active one (a collection dropped on the shell area). */
export function openBeside(state: TabsState, id: string, init: NewTab, side: Side): TabsState {
  const opened = openTab(state, id, init);
  return state.activeId === null ? opened : splitWithTab({ ...opened, activeId: state.activeId }, id, side);
}

/** Breaks a split in two: its active pane stays in place and the other one becomes the tab right after it. */
export function separateTab(state: TabsState, id: string): TabsState {
  const split = splitOf(state, id);
  if (!split) return state;
  const [left, right] = paneIds(split);
  const [keep, other] = split.activePane === 0 ? [left, right] : [right, left];
  const groups = tabGroups(state).flatMap((g) => (g[0] === split.left ? [[keep], [other]] : [g]));
  return { ...state, tabs: fromGroups(state, groups), splits: state.splits.filter((s) => s !== split) };
}

export function setSplitRatio(state: TabsState, id: string, ratio: number): TabsState {
  const split = splitOf(state, id);
  if (!split) return state;
  return { ...state, splits: state.splits.map((s) => (s === split ? { ...s, ratio } : s)) };
}

/** `ratio` kept within what leaves each pane at least MIN_PANE_WIDTH_PX of `width`. */
export function clampRatio(ratio: number, width: number): number {
  if (width <= 2 * MIN_PANE_WIDTH_PX) return DEFAULT_SPLIT_RATIO;
  const min = MIN_PANE_WIDTH_PX / width;
  return Math.min(Math.max(ratio, min), 1 - min);
}

/** Side a tab dropped at `x` lands on, in an area starting at `left` and split at `ratio`. */
export const dropSide = (x: number, left: number, width: number, ratio: number): Side =>
  x - left < width * ratio ? 0 : 1;

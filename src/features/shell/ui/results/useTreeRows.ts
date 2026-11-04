import { useMemo, useState, type KeyboardEvent } from "react";
import type { DateZone } from "../../domain/bsonFormat";
import {
  collapseRecursively,
  expandRecursively,
  isSamePage,
  rowId,
  toggleExpanded,
  visibleTreeRows,
  type TreeRow,
} from "../../domain/resultView";

interface TreeState {
  docs: unknown[];
  expanded: Set<string>;
  selected: number;
}

// A lone result comes in open, like Robo 3T; several start closed.
const fresh = (docs: unknown[]): TreeState => ({
  docs,
  expanded: new Set(docs.length === 1 ? [rowId(0, [])] : []),
  selected: 0,
});

/**
 * Visible rows of the result tree, which ones are open and the selected one, with arrow-key moves;
 * `onMove` hears each move, and whether Shift was held to stretch a pick.
 */
export function useTreeRows(
  docs: unknown[],
  firstNumber: number,
  zone: DateZone,
  onMove?: (row: TreeRow, extend: boolean) => void,
) {
  const [state, setState] = useState(() => fresh(docs));
  // A new page starts over; the same page back after a save keeps what was open.
  const current = state.docs === docs ? state : isSamePage(state.docs, docs) ? { ...state, docs } : fresh(docs);
  if (current !== state) setState(current);

  const rows = useMemo(
    () => visibleTreeRows(docs, firstNumber, current.expanded, zone),
    [docs, firstNumber, current.expanded, zone],
  );

  const clamp = (index: number) => Math.max(0, Math.min(rows.length - 1, index));
  const select = (selected: number) => setState((s) => ({ ...s, selected: clamp(selected) }));
  const toggle = (id: string) => setState((s) => ({ ...s, expanded: toggleExpanded(s.expanded, id) }));
  const expandAll = (row: TreeRow) =>
    setState((s) => ({ ...s, expanded: expandRecursively(s.expanded, row.raw, row.docIndex, row.path) }));
  const collapseAll = (row: TreeRow) =>
    setState((s) => ({ ...s, expanded: collapseRecursively(s.expanded, row.docIndex, row.path) }));

  const onKeyDown = (e: KeyboardEvent) => {
    const row = rows[current.selected];
    if (!row) return;
    const move = (index: number) => {
      select(index);
      onMove?.(rows[clamp(index)], e.shiftKey);
    };
    const parentIndex = () => rows.findIndex((r) => r.id === rowId(row.docIndex, row.path.slice(0, -1)));
    const actions: Record<string, () => void> = {
      ArrowDown: () => move(current.selected + 1),
      ArrowUp: () => move(current.selected - 1),
      Home: () => move(0),
      End: () => move(rows.length - 1),
      Enter: () => row.expandable && toggle(row.id),
      ArrowRight: () => (row.expandable && !row.expanded ? toggle(row.id) : move(current.selected + 1)),
      ArrowLeft: () => (row.expanded ? toggle(row.id) : row.depth > 0 && move(parentIndex())),
    };
    const action = actions[e.key];
    // Ctrl+Enter is left to the shell tab, which runs the script.
    if (!action || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) return;
    e.preventDefault();
    action();
  };

  return { rows, selected: current.selected, select, toggle, expandAll, collapseAll, onKeyDown };
}

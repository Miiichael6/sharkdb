import { useMemo, useState, type KeyboardEvent } from "react";
import type { DateZone } from "../../domain/bsonFormat";
import {
  collapseRecursively,
  expandRecursively,
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

const fresh = (docs: unknown[]): TreeState => ({ docs, expanded: new Set(), selected: 0 });

/** Visible rows of the result tree, which ones are open and the selected one, with arrow-key moves. */
export function useTreeRows(docs: unknown[], firstNumber: number, zone: DateZone) {
  const [state, setState] = useState(() => fresh(docs));
  // A new page starts over, every document closed.
  const current = state.docs === docs ? state : fresh(docs);
  if (current !== state) setState(current);

  const rows = useMemo(
    () => visibleTreeRows(docs, firstNumber, current.expanded, zone),
    [docs, firstNumber, current.expanded, zone],
  );

  const select = (selected: number) => setState((s) => ({ ...s, selected: Math.max(0, Math.min(rows.length - 1, selected)) }));
  const toggle = (id: string) => setState((s) => ({ ...s, expanded: toggleExpanded(s.expanded, id) }));
  const expandAll = (row: TreeRow) =>
    setState((s) => ({ ...s, expanded: expandRecursively(s.expanded, row.raw, row.docIndex, row.path) }));
  const collapseAll = (row: TreeRow) =>
    setState((s) => ({ ...s, expanded: collapseRecursively(s.expanded, row.docIndex, row.path) }));

  const onKeyDown = (e: KeyboardEvent) => {
    const row = rows[current.selected];
    if (!row) return;
    const parentIndex = () => rows.findIndex((r) => r.id === rowId(row.docIndex, row.path.slice(0, -1)));
    const actions: Record<string, () => void> = {
      ArrowDown: () => select(current.selected + 1),
      ArrowUp: () => select(current.selected - 1),
      Home: () => select(0),
      End: () => select(rows.length - 1),
      Enter: () => row.expandable && toggle(row.id),
      ArrowRight: () => (row.expandable && !row.expanded ? toggle(row.id) : select(current.selected + 1)),
      ArrowLeft: () => (row.expanded ? toggle(row.id) : row.depth > 0 && select(parentIndex())),
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  };

  return { rows, selected: current.selected, select, toggle, expandAll, collapseAll, onKeyDown };
}

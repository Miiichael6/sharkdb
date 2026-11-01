import { useState, type KeyboardEvent } from "react";

/** Keys that move between result tabs from the tab list, besides Ctrl+Tab from anywhere in the results. */
const STEP_KEYS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

/** Tabs closed in one run; a new run (`run` changes) opens them all again. */
interface Closed {
  run: unknown;
  indexes: ReadonlySet<number>;
}

/**
 * The result tabs left open and the one on screen. Ctrl+Tab / Ctrl+Shift+Tab (and the arrows on the
 * tab list) cycle through them; `selected` is a position among the open ones.
 */
export function useResultTabs(count: number, run: unknown) {
  const [chosen, setChosen] = useState(0);
  const [closed, setClosed] = useState<Closed>({ run, indexes: new Set() });
  const closedNow = closed.run === run ? closed.indexes : new Set<number>();
  const open = Array.from({ length: count }, (_, i) => i).filter((i) => !closedNow.has(i));
  // A new run, or a closed tab, may leave fewer tabs than the position that was open.
  const selected = Math.max(0, Math.min(chosen, open.length - 1));

  const step = (by: number) => {
    const next = (open.length + selected + by) % open.length;
    setChosen(next);
    return next;
  };

  /** Closes the tab at `position`; the selection stays on the same tab, or its neighbour if it was this one. */
  const close = (position: number) => {
    setClosed({ run, indexes: new Set([...closedNow, open[position]]) });
    if (position < selected || (position === selected && selected === open.length - 1)) setChosen(selected - 1);
  };

  const onPanelKeyDown = (e: KeyboardEvent) => {
    if (!e.ctrlKey || e.key !== "Tab" || !open.length) return;
    e.preventDefault();
    step(e.shiftKey ? -1 : 1);
  };

  // Focus follows the selection, as the tab list has a single tab stop.
  const onListKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const by = STEP_KEYS[e.key];
    if (!by || !open.length) return;
    e.preventDefault();
    e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[step(by)]?.focus();
  };

  return { open, selected, select: setChosen, close, onPanelKeyDown, onListKeyDown };
}

export type ResultTabsState = ReturnType<typeof useResultTabs>;

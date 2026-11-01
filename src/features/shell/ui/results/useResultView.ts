import { useState } from "react";
import type { DateZone } from "../../domain/bsonFormat";
import type { ViewMode } from "../../domain/resultView";

export interface ResultView {
  mode: ViewMode;
  zone: DateZone;
}

export interface ResultViewState extends ResultView {
  setMode: (mode: ViewMode) => void;
  setZone: (zone: DateZone) => void;
}

/** How a result starts out. */
export const DEFAULT_VIEW: ResultView = { mode: "tree", zone: "utc" };

export interface ResultViews {
  /** The view of the results at `indexes` (by the first one); setting it sets them all. */
  stateOf: (indexes: readonly number[]) => ResultViewState;
  /** Back to the default, for a closed sub-tab. */
  reset: (index: number) => void;
}

/**
 * How a shell tab shows its results: each result (by its position among the run's results, so each
 * sub-tab) has its own view, kept across the tab's runs until its sub-tab is closed.
 */
export function useResultViews(): ResultViews {
  const [views, setViews] = useState<ReadonlyMap<number, ResultView>>(new Map());

  const patch = (indexes: readonly number[], change: Partial<ResultView>) =>
    setViews((current) => {
      const next = new Map(current);
      for (const i of indexes) next.set(i, { ...(current.get(i) ?? DEFAULT_VIEW), ...change });
      return next;
    });

  const stateOf = (indexes: readonly number[]): ResultViewState => ({
    ...(views.get(indexes[0] ?? 0) ?? DEFAULT_VIEW),
    setMode: (mode) => patch(indexes, { mode }),
    setZone: (zone) => patch(indexes, { zone }),
  });

  const reset = (index: number) =>
    setViews((current) => {
      if (!current.has(index)) return current;
      const next = new Map(current);
      next.delete(index);
      return next;
    });

  return { stateOf, reset };
}

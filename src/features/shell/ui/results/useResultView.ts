import { useState } from "react";
import type { DateZone } from "../../domain/bsonFormat";
import { documentViewMode, isConsoleOn, type DocumentViewMode, type ViewMode } from "../../domain/resultView";

export interface ResultView {
  mode: DocumentViewMode;
  zone: DateZone;
}

export interface ResultViewState extends ResultView {
  setMode: (mode: DocumentViewMode) => void;
  setZone: (zone: DateZone) => void;
}

export interface ResultViews {
  /** The view of the results at `indexes` (by the first one); setting it sets them all. */
  stateOf: (indexes: readonly number[]) => ResultViewState;
  /** Back to the default, for a closed sub-tab. */
  reset: (index: number) => void;
  /** The Console is on: the whole run in one list, without sub-tabs, whatever each result's view. */
  consoleOn: boolean;
  setConsoleOn: (on: boolean) => void;
}

/**
 * How a shell tab shows its results: each result (by its position among the run's results, so each
 * sub-tab) has its own view, kept across the tab's runs until its sub-tab is closed. Until it is
 * changed, a result shows the preferences' view. The Console belongs to the whole tab, not to a result.
 */
export function useResultViews(preferred: { mode: ViewMode; zone: DateZone }): ResultViews {
  const initial: ResultView = { mode: documentViewMode(preferred.mode), zone: preferred.zone };
  const [views, setViews] = useState<ReadonlyMap<number, ResultView>>(new Map());
  // Null until switched: follows the preferences, like a result's view.
  const [consoleChoice, setConsoleOn] = useState<boolean | null>(null);
  const consoleOn = isConsoleOn(consoleChoice, preferred.mode);

  const patch = (indexes: readonly number[], change: Partial<ResultView>) =>
    setViews((current) => {
      const next = new Map(current);
      for (const i of indexes) next.set(i, { ...(current.get(i) ?? initial), ...change });
      return next;
    });

  const stateOf = (indexes: readonly number[]): ResultViewState => ({
    ...(views.get(indexes[0] ?? 0) ?? initial),
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

  return { stateOf, reset, consoleOn, setConsoleOn };
}

import { useState } from "react";
import type { DateZone } from "../../domain/bsonFormat";
import type { ViewMode } from "../../domain/resultView";

export interface ResultViewState {
  mode: ViewMode;
  zone: DateZone;
  setMode: (mode: ViewMode) => void;
  setZone: (zone: DateZone) => void;
}

/** How a tab shows its results; kept across runs so switching doesn't re-execute (08 will persist it). */
export function useResultView(): ResultViewState {
  const [mode, setMode] = useState<ViewMode>("tree");
  const [zone, setZone] = useState<DateZone>("utc");
  return { mode, zone, setMode, setZone };
}

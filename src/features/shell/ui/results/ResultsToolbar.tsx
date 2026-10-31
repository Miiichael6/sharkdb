import { VIEW_MODES } from "../../domain/resultView";
import type { ResultViewState } from "./useResultView";
import { ZoneToggle } from "./ZoneToggle";

/** View mode (árbol / tabla / texto) and date zone; both re-render the results without running again. */
export function ResultsToolbar({ view }: { view: ResultViewState }) {
  return (
    <div className="results-toolbar">
      <div className="segmented" role="group" aria-label="Modo de vista">
        {VIEW_MODES.map(({ mode, label }) => (
          <button key={mode} aria-pressed={view.mode === mode} className={view.mode === mode ? "active" : ""} onClick={() => view.setMode(mode)}>
            {label}
          </button>
        ))}
      </div>
      <span className="spacer" />
      <ZoneToggle zone={view.zone} onChange={view.setZone} />
    </div>
  );
}

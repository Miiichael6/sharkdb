import type { DateZone } from "../../domain/bsonFormat";
import { VIEW_MODES } from "../../domain/resultView";
import type { ResultViewState } from "./useResultView";

const ZONES: { zone: DateZone; label: string; title: string }[] = [
  { zone: "utc", label: "UTC", title: "Fechas en UTC" },
  { zone: "local", label: "Local", title: "Fechas en la hora local de este equipo" },
];

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
      <div className="segmented" role="group" aria-label="Zona horaria de las fechas">
        {ZONES.map(({ zone, label, title }) => (
          <button key={zone} title={title} aria-pressed={view.zone === zone} className={view.zone === zone ? "active" : ""} onClick={() => view.setZone(zone)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

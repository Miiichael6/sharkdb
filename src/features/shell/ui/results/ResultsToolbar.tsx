import { DOCUMENT_VIEW_MODES } from "../../domain/resultView";
import type { ResultViewState } from "./useResultView";
import { ZoneToggle } from "./ZoneToggle";

interface Props {
  view: ResultViewState;
  consoleOn: boolean;
  onConsole: (on: boolean) => void;
}

/**
 * View mode (árbol / tabla / texto), the Console and the date zone; all re-render the results without
 * running again. Picking a document view leaves the Console.
 */
export function ResultsToolbar({ view, consoleOn, onConsole }: Props) {
  return (
    <div className="results-toolbar">
      <div className="segmented" role="group" aria-label="Modo de vista">
        {DOCUMENT_VIEW_MODES.map(({ mode, label }) => {
          const active = !consoleOn && view.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              className={active ? "active" : ""}
              onClick={() => {
                view.setMode(mode);
                onConsole(false);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <span className="spacer" />
      <div className="segmented" role="group" aria-label="Consola">
        <button
          type="button"
          title="La salida del script tal como la imprime la consola"
          aria-pressed={consoleOn}
          className={consoleOn ? "active" : ""}
          onClick={() => onConsole(!consoleOn)}
        >
          Consola
        </button>
      </div>
      <ZoneToggle zone={view.zone} onChange={view.setZone} />
    </div>
  );
}

import { useMemo } from "react";
import { bsonValue } from "../../domain/bsonValue";
import { consoleEntries, resultConsoleEntries, type ConsoleEntry } from "../../domain/consoleEntry";
import { topLevelText } from "../../domain/consolePreview";
import type { ScriptOutcome } from "../../domain/outcome";
import type { ResultEntry } from "../../domain/resultLayout";
import type { RunState } from "../useShellRun";
import { ConsoleCursor } from "./ConsoleCursor";
import { ConsolePrint } from "./ConsolePrint";
import { ConsoleValue } from "./ConsoleValue";
import { ScriptErrorLine } from "./ResultEntryView";
import type { ResultViewState } from "./useResultView";

interface Props {
  outcome: ScriptOutcome;
  run: RunState;
  view: ResultViewState;
  /** Only this result's (a sub-tab's); else the whole run's. */
  entry?: ResultEntry;
  /** Clicked `L#`: shows that line of the editor. */
  onGoToLine: (line: number) => void;
}

function EntryBody({ entry, run, view }: { entry: ConsoleEntry; run: RunState; view: ResultViewState }) {
  switch (entry.kind) {
    case "print":
      return <ConsolePrint text={entry.text} values={entry.values} json={entry.json} zone={view.zone} />;
    case "error":
      return <ScriptErrorLine error={entry.error} />;
    case "cursor": {
      const pager = run.pagers.get(entry.index);
      return pager ? <ConsoleCursor pager={pager} view={view} /> : null;
    }
    case "scalar":
      return <span className={`console-scalar bson-${bsonValue(entry.value).type}`}>{topLevelText(entry.value, view.zone)}</span>;
    case "array":
      return <ConsoleValue value={entry.value} zone={view.zone} />;
    case "object":
      return <ConsoleValue value={entry.value} zone={view.zone} label={entry.label} />;
  }
}

/** Every result of the run (or of one statement) in one list, in order and with its line, as the browser's console shows them. */
export function ConsoleView({ outcome, run, view, entry, onGoToLine }: Props) {
  const entries = useMemo(() => (entry ? resultConsoleEntries(outcome, entry) : consoleEntries(outcome)), [outcome, entry]);
  if (!entries.length) return <div className="script-output muted small">El script no devolvió nada.</div>;
  return (
    <div className="console-view" role="log" aria-label="Consola">
      {entries.map((entry, i) => (
        <div key={i} className={`console-row ${entry.kind === "error" ? "error" : ""}`}>
          {entry.line ? (
            <button className="console-line mono" title={`Ir a la línea ${entry.line}`} onClick={() => onGoToLine(entry.line!)}>
              L{entry.line}
            </button>
          ) : (
            <span className="console-line" />
          )}
          <div className="console-body">
            <EntryBody entry={entry} run={run} view={view} />
          </div>
        </div>
      ))}
    </div>
  );
}

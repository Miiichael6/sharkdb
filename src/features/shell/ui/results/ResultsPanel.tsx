import { Spinner } from "../../../../shared/ui/common";
import { scriptErrorText, type ScriptResult } from "../../domain/outcome";
import type { RunState } from "../useShellRun";
import { CursorResult } from "./CursorResult";
import { ResultsToolbar } from "./ResultsToolbar";
import type { ResultViewState } from "./useResultView";
import { ValueResult } from "./ValueResult";

interface Props {
  /** Session the script ran in. */
  sid: string;
  run: RunState;
  view: ResultViewState;
}

function ResultItem({ sid, result, index, run, view }: Props & { result: ScriptResult; index: number }) {
  switch (result.kind) {
    case "print":
      return <pre className="output-print">{result.text}</pre>;
    case "cursor": {
      const pager = run.pagers.get(index);
      return pager ? <CursorResult sid={sid} pager={pager} view={view} /> : null;
    }
    default:
      return <ValueResult value={result.value} view={view} />;
  }
}

/** What the last run printed and returned, stacked in order, under the view toolbar. */
function RunOutput({ sid, run, view }: Props) {
  if (run.running) return <div className="script-output center"><Spinner /></div>;
  if (run.failure) return <div className="script-output"><div className="output-error">{run.failure}</div></div>;
  if (!run.outcome) {
    return <div className="script-output center muted small">Ctrl+Enter o F5 ejecuta la selección o todo el script</div>;
  }
  const { results, error } = run.outcome;
  return (
    <div className="script-output">
      {results.map((r, i) => (
        <ResultItem key={i} sid={sid} result={r} index={i} run={run} view={view} />
      ))}
      {error && <div className={`output-error${error.kind === "readOnly" ? " read-only" : ""}`}>{scriptErrorText(error)}</div>}
      {!error && !results.length && <div className="muted small">El script no devolvió nada.</div>}
    </div>
  );
}

/** Results area of a shell tab. */
export function ResultsPanel({ sid, run, view }: Props) {
  return (
    <div className="results-panel">
      <ResultsToolbar view={view} />
      <RunOutput sid={sid} run={run} view={view} />
    </div>
  );
}

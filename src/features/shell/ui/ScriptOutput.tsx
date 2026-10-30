import { Spinner } from "../../../shared/ui/common";
import type { ScriptError, ScriptResult } from "../domain/outcome";
import { CursorResultView } from "./CursorResultView";
import type { RunState } from "./useShellRun";

const ERROR_TITLE: Record<ScriptError["kind"], string> = {
  script: "Error",
  timeout: "Tiempo agotado",
  cancelled: "Detenido",
  outOfMemory: "Sin memoria",
  conversion: "Resultado no convertible",
};

function errorText(e: ScriptError): string {
  const at = e.line ? ` (línea ${e.line}${e.column ? `, columna ${e.column}` : ""})` : "";
  return `${ERROR_TITLE[e.kind]}${at}: ${e.message}`;
}

function ResultItem({ result, index, run }: { result: ScriptResult; index: number; run: RunState }) {
  switch (result.kind) {
    case "print":
      return <pre className="output-print">{result.text}</pre>;
    case "cursor": {
      const pager = run.pagers.get(index);
      return pager ? <CursorResultView pager={pager} /> : null;
    }
    default:
      return <pre className="json">{JSON.stringify(result.value, null, 2)}</pre>;
  }
}

/** What the last run of a tab printed and returned. */
export function ScriptOutput({ run }: { run: RunState }) {
  if (run.running) {
    return (
      <div className="script-output center">
        <Spinner />
      </div>
    );
  }
  if (run.failure) return <div className="script-output"><div className="output-error">{run.failure}</div></div>;
  if (!run.outcome) {
    return (
      <div className="script-output center muted small">
        Ctrl+Enter o F5 ejecuta la selección o todo el script
      </div>
    );
  }
  const { results, error } = run.outcome;
  return (
    <div className="script-output">
      {results.map((r, i) => (
        <ResultItem key={i} result={r} index={i} run={run} />
      ))}
      {error && <div className="output-error">{errorText(error)}</div>}
      {!error && !results.length && <div className="muted small">El script no devolvió nada.</div>}
    </div>
  );
}

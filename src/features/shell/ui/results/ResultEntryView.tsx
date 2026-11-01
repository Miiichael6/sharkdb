import { scriptErrorText, type ScriptError } from "../../domain/outcome";
import type { EntryValue, ResultEntry } from "../../domain/resultLayout";
import type { RunState } from "../useShellRun";
import { CursorResult } from "./CursorResult";
import type { ResultViewState } from "./useResultView";
import { ValueResult } from "./ValueResult";

interface Props {
  /** Session the script ran in. */
  sid: string;
  entry: ResultEntry;
  run: RunState;
  view: ResultViewState;
  /** Shown at the top when several results share the panel; a lone result has none, as before. */
  title?: string;
}

export function ScriptErrorLine({ error }: { error: ScriptError }) {
  return <div className={`output-error${error.kind === "readOnly" ? " read-only" : ""}`}>{scriptErrorText(error)}</div>;
}

function ValueView({ sid, value, run, view, title }: Omit<Props, "entry"> & { value: EntryValue }) {
  const { result, index } = value;
  switch (result.kind) {
    case "print":
      return null;
    case "cursor": {
      const pager = run.pagers.get(index);
      return pager ? <CursorResult sid={sid} pager={pager} view={view} title={title} /> : null;
    }
    default:
      return <ValueResult value={result.value} view={view} title={title} />;
  }
}

/** What one statement printed and returned, or the error that stopped the run. */
export function ResultEntryView({ sid, entry, run, view, title }: Props) {
  if (entry.kind === "error") return <ScriptErrorLine error={entry.error} />;
  const { prints, value } = entry;
  // The value's own header carries the title, unless prints come first: then it goes above them.
  const ownHead = title && (!value || prints.length > 0);
  return (
    <>
      {ownHead && (
        <header className="result-head">
          <span className="mono">{title}</span>
        </header>
      )}
      {prints.map((text, i) => (
        <pre key={i} className="output-print">
          {text}
        </pre>
      ))}
      {value && <ValueView sid={sid} value={value} run={run} view={view} title={ownHead ? undefined : title} />}
    </>
  );
}

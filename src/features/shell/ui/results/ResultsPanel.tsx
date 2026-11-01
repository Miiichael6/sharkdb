import { SwimmingShark } from "../../../../shared/ui/common";
import { resultEntries, resultLayout, TRUNCATED_TEXT, type ResultEntry } from "../../domain/resultLayout";
import type { RunState } from "../useShellRun";
import { ResultEntryView } from "./ResultEntryView";
import { ResultsToolbar } from "./ResultsToolbar";
import { ResultTabs } from "./ResultTabs";
import { StackedResults } from "./StackedResults";
import type { ResultViewState } from "./useResultView";

interface Props {
  /** Session the script ran in. */
  sid: string;
  run: RunState;
  view: ResultViewState;
}

/** One result fills the area as it always did; two stack; three or more go into sub-tabs. */
function LaidOutResults({ sid, run, view, entries }: Props & { entries: ResultEntry[] }) {
  switch (resultLayout(entries)) {
    case "tabs":
      return <ResultTabs sid={sid} entries={entries} run={run} view={view} />;
    case "stacked":
      return <StackedResults sid={sid} entries={entries} run={run} view={view} />;
    default:
      return (
        <div className="script-output">
          {entries.length ? <ResultEntryView sid={sid} entry={entries[0]} run={run} view={view} /> : <div className="muted small">El script no devolvió nada.</div>}
        </div>
      );
  }
}

/** What the last run printed and returned, one result per statement. */
function RunOutput({ sid, run, view }: Props) {
  if (run.running) return <div className="script-output center"><SwimmingShark /></div>;
  if (run.failure) return <div className="script-output"><div className="output-error">{run.failure}</div></div>;
  if (!run.outcome) {
    return <div className="script-output center muted small">Ctrl+Enter o F5 ejecuta la selección o todo el script</div>;
  }
  return (
    <>
      <LaidOutResults sid={sid} run={run} view={view} entries={resultEntries(run.outcome)} />
      {run.outcome.truncated && <div className="results-truncated muted small">{TRUNCATED_TEXT}</div>}
    </>
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

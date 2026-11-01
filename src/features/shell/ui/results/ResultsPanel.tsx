import { useMemo } from "react";
import { SwimmingShark } from "../../../../shared/ui/common";
import { resultEntries, resultLayout, TRUNCATED_TEXT, type ResultEntry, type ResultLayout } from "../../domain/resultLayout";
import type { RunState } from "../useShellRun";
import { ConsoleView } from "./ConsoleView";
import { ResultEntryView } from "./ResultEntryView";
import { ResultsToolbar } from "./ResultsToolbar";
import { ResultTabs } from "./ResultTabs";
import { StackedResults } from "./StackedResults";
import { useResultTabs, type ResultTabsState } from "./useResultTabs";
import type { ResultViews, ResultViewState } from "./useResultView";

interface Props {
  /** Session the script ran in. */
  sid: string;
  run: RunState;
  views: ResultViews;
  /** The console's `L#` was clicked. */
  onGoToLine: (line: number) => void;
}

interface Laid {
  entries: ResultEntry[];
  layout: ResultLayout;
  tabs: ResultTabsState;
  /** The view the toolbar sets: the shown sub-tab's, or the one all results share outside sub-tabs. */
  view: ResultViewState;
}

/** One result fills the area as it always did; two stack; three or more go into sub-tabs. */
function LaidOutResults({ sid, run, views, onGoToLine, entries, layout, tabs, view }: Props & Laid) {
  switch (layout) {
    case "tabs":
      return <ResultTabs sid={sid} entries={entries} run={run} tabs={tabs} views={views} onGoToLine={onGoToLine} />;
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
function RunOutput(props: Props & Laid) {
  const { run, view, layout, onGoToLine } = props;
  if (run.running) return <div className="script-output center"><SwimmingShark /></div>;
  if (run.failure) return <div className="script-output"><div className="output-error">{run.failure}</div></div>;
  if (!run.outcome) {
    return <div className="script-output center muted small">Ctrl+Enter o F5 ejecuta la selección o todo el script</div>;
  }
  return (
    <>
      {/* In sub-tabs each one picks its own view, Console included. */}
      {view.mode === "console" && layout !== "tabs" ? (
        <ConsoleView outcome={run.outcome} run={run} view={view} onGoToLine={onGoToLine} />
      ) : (
        <LaidOutResults {...props} />
      )}
      {run.outcome.truncated && <div className="results-truncated muted small">{TRUNCATED_TEXT}</div>}
    </>
  );
}

/** Results area of a shell tab. */
export function ResultsPanel(props: Props) {
  const { run, views } = props;
  const entries = useMemo(() => (run.outcome ? resultEntries(run.outcome) : []), [run.outcome]);
  const layout = resultLayout(entries);
  const tabs = useResultTabs(entries.length, run.outcome);
  const view =
    layout === "tabs" && tabs.open.length
      ? views.stateOf([tabs.open[tabs.selected]])
      : views.stateOf(entries.length ? entries.map((_, i) => i) : [0]);
  const laid = { entries, layout, tabs, view };
  return (
    <div className="results-panel">
      <ResultsToolbar view={view} />
      <RunOutput {...props} {...laid} />
    </div>
  );
}

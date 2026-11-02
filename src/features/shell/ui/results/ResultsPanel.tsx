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
  /**
   * The view the toolbar sets: the shown sub-tab's, or the one all results share outside sub-tabs. In
   * the Console, its date zone is all results', since it lists them all.
   */
  view: ResultViewState;
}

/** One result fills the area as it always did; two stack; three or more go into sub-tabs. */
function LaidOutResults({ sid, run, views, entries, layout, tabs, view }: Props & Laid) {
  switch (layout) {
    case "tabs":
      return <ResultTabs sid={sid} entries={entries} run={run} tabs={tabs} views={views} />;
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
  const { run, views, view, onGoToLine } = props;
  if (run.running) return <div className="script-output center"><SwimmingShark /></div>;
  if (run.failure) return <div className="script-output"><div className="output-error">{run.failure}</div></div>;
  if (!run.outcome) {
    return <div className="script-output center muted small">Ctrl+Enter o F5 ejecuta la selección o todo el script</div>;
  }
  return (
    <>
      {/* The Console lists the whole run as a script prints it: no sub-tabs, however many results. */}
      {views.consoleOn ? (
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
  const all = views.stateOf(entries.length ? entries.map((_, i) => i) : [0]);
  const shown = layout === "tabs" && tabs.open.length ? views.stateOf([tabs.open[tabs.selected]]) : all;
  const view = views.consoleOn ? { ...shown, zone: all.zone, setZone: all.setZone } : shown;
  const laid = { entries, layout, tabs, view };
  return (
    <div className="results-panel">
      <ResultsToolbar view={view} consoleOn={views.consoleOn} onConsole={views.setConsoleOn} />
      <RunOutput {...props} {...laid} />
    </div>
  );
}

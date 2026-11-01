import { resultTitle, type ResultEntry } from "../../domain/resultLayout";
import type { RunState } from "../useShellRun";
import { ResultEntryView } from "./ResultEntryView";
import type { ResultViewState } from "./useResultView";

interface Props {
  sid: string;
  entries: ResultEntry[];
  run: RunState;
  view: ResultViewState;
}

/** A few results one under another, each with its title and an equal share of the height. */
export function StackedResults({ sid, entries, run, view }: Props) {
  return (
    <div className="stacked-results">
      {entries.map((entry, i) => (
        <section key={i} className="stacked-result" aria-label={resultTitle(entry)}>
          <ResultEntryView sid={sid} entry={entry} run={run} view={view} title={resultTitle(entry)} />
        </section>
      ))}
    </div>
  );
}

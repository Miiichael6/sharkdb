import { useMemo, useRef } from "react";
import { useServices } from "../../../app/services";
import { formatScript } from "../domain/formatScript";
import type { ShellTab as Tab } from "../domain/tabs";
import { shellCompletionSource } from "./completionSource";
import { QueryEditor } from "./QueryEditor";
import { ResultsPanel } from "./results/ResultsPanel";
import { useResultView } from "./results/useResultView";
import { useHistoryBrowser } from "./useHistoryBrowser";
import { useShellRun } from "./useShellRun";

interface Props {
  tab: Tab;
  active: boolean;
  onCodeChange: (code: string) => void;
  onOpenFile: () => void;
  onSave: () => void;
}

/** A shell tab: where it runs (server · database · last run time), the script editor and its results. */
export function ShellTab({ tab, active, onCodeChange, onOpenFile, onSave }: Props) {
  const { schema } = useServices();
  const run = useShellRun(tab);
  const view = useResultView();
  const history = useHistoryBrowser(tab.sid);
  const target = useRef(tab);
  target.current = tab;
  const completion = useMemo(() => shellCompletionSource(schema, () => target.current), [schema]);

  const execute = (code: string) => {
    history.reset();
    run.run(code);
  };
  const format = () => onCodeChange(formatScript(tab.code));

  return (
    <section className="shell-tab" hidden={!active} aria-label={`Shell ${tab.title}`}>
      <header className="shell-head">
        <span className="shell-where">
          <strong>{tab.serverLabel}</strong> · {tab.db}
          {run.outcome && <span className="muted"> · {run.outcome.elapsedMs} ms</span>}
        </span>
        <span className="spacer" />
        {run.running ? (
          <button className="danger" onClick={run.cancel}>
            Detener
          </button>
        ) : (
          <button className="primary" onClick={() => execute(tab.code)} title="Ctrl+Enter / F5">
            Ejecutar
          </button>
        )}
        <button className="ghost" onClick={onOpenFile} title="Ctrl+O">
          Abrir
        </button>
        <button className="ghost" onClick={onSave} title="Ctrl+S">
          Guardar
        </button>
        <button className="ghost" onClick={format} title="Ctrl+Shift+F">
          Formatear
        </button>
      </header>
      <QueryEditor
        value={tab.code}
        onChange={onCodeChange}
        onRun={execute}
        onHistory={history.step}
        completion={completion}
        autoFocus
      />
      <ResultsPanel sid={tab.sid} run={run} view={view} />
    </section>
  );
}

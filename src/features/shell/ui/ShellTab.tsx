import { useEffect, useMemo, useRef, useState } from "react";
import { useServices } from "../../../app/services";
import { StackSplit, type TopFit } from "../../../shared/ui/StackSplit";
import { formatScript } from "../domain/formatScript";
import type { ShellTab as Tab } from "../domain/tabs";
import { shellCompletionSource } from "./completionSource";
import { QueryEditor } from "./QueryEditor";
import { ShellActionIcon } from "./ShellActionIcon";
import { ResultsPanel } from "./results/ResultsPanel";
import { useResultView } from "./results/useResultView";
import { useHistoryBrowser } from "./useHistoryBrowser";
import { useShellRun } from "./useShellRun";

/** Whether the script editor was last hidden (new tabs start the same way). */
const EDITOR_HIDDEN_KEY = "robo3b.shellEditorHidden";

function readEditorHidden(): boolean {
  try {
    return localStorage.getItem(EDITOR_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function saveEditorHidden(hidden: boolean) {
  try {
    localStorage.setItem(EDITOR_HIDDEN_KEY, hidden ? "1" : "0");
  } catch {
    // Not remembering it is harmless.
  }
}

/** The editor grows with the script up to this many lines; past that it scrolls (or is dragged taller). */
const MAX_FIT_LINES = 17;

/**
 * Editor heights for a script of `lines` lines: as tall as the script up to MAX_FIT_LINES, never less
 * than one line, never more than the whole script. Only the first line's height is read: CodeMirror
 * leaves lines outside the viewport unrendered.
 */
function editorFit(pane: HTMLElement, lines: number): TopFit {
  const content = pane.querySelector<HTMLElement>(".cm-content");
  const line = pane.querySelector<HTMLElement>(".cm-line");
  const scroller = pane.querySelector<HTMLElement>(".cm-scroller");
  if (!content || !line || !scroller) return { height: 0, min: 0, max: 0 };
  const style = getComputedStyle(content);
  // Padding, the border slack and a horizontal scrollbar when a long line brings one.
  const extra =
    parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + 2 + (scroller.offsetHeight - scroller.clientHeight);
  const px = (n: number) => line.offsetHeight * n + extra;
  return { height: px(Math.min(lines, MAX_FIT_LINES)), min: px(1), max: px(lines) };
}

interface Props {
  tab: Tab;
  active: boolean;
  onCodeChange: (code: string) => void;
  onOpenFile: () => void;
  onSave: () => void;
}

/**
 * A shell tab: where it runs (server · database · last run time), the script editor (as tall as its
 * script, up to MAX_FIT_LINES, and can be hidden) and its results, resizable.
 */
export function ShellTab({ tab, active, onCodeChange, onOpenFile, onSave }: Props) {
  const { schema } = useServices();
  const run = useShellRun(tab);
  const view = useResultView();
  const history = useHistoryBrowser(tab.sid);
  const [editorHidden, setEditorHidden] = useState(readEditorHidden);
  const target = useRef(tab);
  target.current = tab;
  const completion = useMemo(() => shellCompletionSource(schema, () => target.current), [schema]);

  const execute = (code: string) => {
    history.reset();
    run.run(code);
  };
  const format = () => onCodeChange(formatScript(tab.code));
  const lines = tab.code.split("\n").length;
  const toggleEditor = () => {
    setEditorHidden(!editorHidden);
    saveEditorHidden(!editorHidden);
  };

  // The ref survives StrictMode's second effect run, so the query runs once.
  const ranOnOpen = useRef(false);
  useEffect(() => {
    if (!tab.runOnOpen || ranOnOpen.current) return;
    ranOnOpen.current = true;
    execute(tab.code);
  }, []);

  return (
    <section className="shell-tab" hidden={!active} aria-label={`Shell ${tab.title}`}>
      <header className="shell-head">
        <span className="shell-where">
          <strong>{tab.serverLabel}</strong> · {tab.db}
          {run.outcome && <span className="muted"> · {run.outcome.elapsedMs} ms</span>}
        </span>
        <span className="spacer" />
        {run.running ? (
          <button className="danger shell-action" onClick={run.cancel} title="Detener" aria-label="Detener">
            <ShellActionIcon action="stop" />
          </button>
        ) : (
          <button
            className="primary shell-action"
            onClick={() => execute(tab.code)}
            title="Ejecutar (Ctrl+Enter / F5)"
            aria-label="Ejecutar"
          >
            <ShellActionIcon action="run" />
          </button>
        )}
        <button className="ghost shell-action" onClick={onOpenFile} title="Abrir (Ctrl+O)" aria-label="Abrir">
          <ShellActionIcon action="open" />
        </button>
        <button className="ghost shell-action" onClick={onSave} title="Guardar (Ctrl+S)" aria-label="Guardar">
          <ShellActionIcon action="save" />
        </button>
        <button
          className="ghost shell-action"
          onClick={format}
          title="Formatear (Ctrl+Shift+F)"
          aria-label="Formatear"
        >
          <ShellActionIcon action="format" />
        </button>
        <span className="shell-head-sep" aria-hidden />
        <button
          className="ghost shell-action"
          onClick={toggleEditor}
          title={editorHidden ? "Mostrar editor" : "Ocultar editor"}
          aria-label={editorHidden ? "Mostrar editor" : "Ocultar editor"}
          aria-pressed={editorHidden}
        >
          <ShellActionIcon action={editorHidden ? "showEditor" : "hideEditor"} />
        </button>
      </header>
      <StackSplit
        label="Redimensionar editor y resultados"
        topHidden={editorHidden}
        fitTop={(pane) => editorFit(pane, lines)}
        fitKey={lines}
        top={
          <QueryEditor
            value={tab.code}
            onChange={onCodeChange}
            onRun={execute}
            onHistory={history.step}
            completion={completion}
            autoFocus
          />
        }
        bottom={<ResultsPanel sid={tab.sid} run={run} view={view} />}
      />
    </section>
  );
}

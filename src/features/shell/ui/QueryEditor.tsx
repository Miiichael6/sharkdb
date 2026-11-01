import { acceptCompletion, autocompletion, type CompletionSource } from "@codemirror/autocomplete";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef, useState } from "react";
import { CodeEditor, replaceAll } from "../../../shared/ui/CodeEditor";
import { formatScript } from "../domain/formatScript";
import type { ScriptError } from "../domain/outcome";
import { SCRIPT_START, type RunOrigin } from "../domain/runOrigin";
import { errorMark, markError } from "./errorMark";

interface Props {
  value: string;
  onChange: (code: string) => void;
  /** Ctrl+Enter / F5 with the selected text and where it starts, or the whole script when nothing is selected. */
  onRun: (code: string, origin: RunOrigin) => void;
  /** Ctrl+↑ / Ctrl+↓: the history entry to show, or null to leave the editor as is. */
  onHistory: (direction: "older" | "newer", current: string) => Promise<string | null>;
  completion: CompletionSource;
  /** The last run's error, marked on its line until the text changes; null clears the mark. */
  error: ScriptError | null;
  /** The editor once created, to move it from outside (the console's `L#`). */
  onView?: (view: EditorView) => void;
  autoFocus?: boolean;
}

/** Where the selection starts, in the editor's lines. */
function selectionOrigin(view: EditorView, from: number): RunOrigin {
  const line = view.state.doc.lineAt(from);
  return { line: line.number, column: from - line.from };
}

/** Script editor of a shell tab: run, format and history shortcuts plus autocompletion. */
export function QueryEditor({ value, onChange, onRun, onHistory, completion, error, onView, autoFocus }: Props) {
  const handlers = useRef({ onRun, onHistory });
  handlers.current = { onRun, onHistory };

  const [extensions] = useState(() => {
    const run = (v: EditorView) => {
      const sel = v.state.selection.main;
      if (sel.empty) handlers.current.onRun(v.state.doc.toString(), SCRIPT_START);
      else handlers.current.onRun(v.state.sliceDoc(sel.from, sel.to), selectionOrigin(v, sel.from));
      return true;
    };
    const browse = (direction: "older" | "newer") => (v: EditorView) => {
      handlers.current.onHistory(direction, v.state.doc.toString()).then((code) => code !== null && replaceAll(v, code));
      return true;
    };
    const shortcuts = keymap.of([
      { key: "Mod-Enter", run },
      { key: "F5", run },
      { key: "Shift-Mod-f", run: (v) => (replaceAll(v, formatScript(v.state.doc.toString())), true) },
      { key: "Mod-ArrowUp", run: browse("older") },
      { key: "Mod-ArrowDown", run: browse("newer") },
      // Tab takes the highlighted suggestion, like Enter; with no list open it does what it did before.
      { key: "Tab", run: acceptCompletion },
    ]);
    return [Prec.highest(shortcuts), autocompletion({ override: [completion] }), errorMark];
  });

  const view = useRef<EditorView | null>(null);
  useEffect(() => {
    if (view.current) markError(view.current, error);
  }, [error]);

  return (
    <CodeEditor
      className="query-editor"
      value={value}
      onChange={onChange}
      extensions={extensions}
      onView={(v) => {
        view.current = v;
        onView?.(v);
      }}
      autoFocus={autoFocus}
    />
  );
}

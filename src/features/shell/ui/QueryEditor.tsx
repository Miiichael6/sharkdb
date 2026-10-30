import { autocompletion, type CompletionSource } from "@codemirror/autocomplete";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useRef, useState } from "react";
import { CodeEditor, replaceAll } from "../../../shared/ui/CodeEditor";
import { formatScript } from "../domain/formatScript";

interface Props {
  value: string;
  onChange: (code: string) => void;
  /** Ctrl+Enter / F5 with the selected text, or the whole script when nothing is selected. */
  onRun: (code: string) => void;
  /** Ctrl+↑ / Ctrl+↓: the history entry to show, or null to leave the editor as is. */
  onHistory: (direction: "older" | "newer", current: string) => Promise<string | null>;
  completion: CompletionSource;
  autoFocus?: boolean;
}

/** Script editor of a shell tab: run, format and history shortcuts plus autocompletion. */
export function QueryEditor({ value, onChange, onRun, onHistory, completion, autoFocus }: Props) {
  const handlers = useRef({ onRun, onHistory });
  handlers.current = { onRun, onHistory };

  const [extensions] = useState(() => {
    const run = (v: EditorView) => {
      const sel = v.state.selection.main;
      handlers.current.onRun(sel.empty ? v.state.doc.toString() : v.state.sliceDoc(sel.from, sel.to));
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
    ]);
    return [Prec.highest(shortcuts), autocompletion({ override: [completion] })];
  });

  return <CodeEditor className="query-editor" value={value} onChange={onChange} extensions={extensions} autoFocus={autoFocus} />;
}

import { autocompletion, type CompletionSource } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { EditorState, Prec } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
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

const fillParent = EditorView.theme({ "&": { height: "100%" }, ".cm-scroller": { fontFamily: '"Cascadia Mono", Consolas, monospace' } });

function replaceAll(view: EditorView, code: string) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
}

/** CodeMirror script editor of a shell tab. `value` changes from outside (format, history, file) are applied in place. */
export function QueryEditor({ value, onChange, onRun, onHistory, completion, autoFocus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const handlers = useRef({ onChange, onRun, onHistory });
  handlers.current = { onChange, onRun, onHistory };

  useEffect(() => {
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

    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          Prec.highest(shortcuts),
          basicSetup,
          javascript(),
          autocompletion({ override: [completion] }),
          oneDark,
          fillParent,
          EditorView.updateListener.of((u) => u.docChanged && handlers.current.onChange(u.state.doc.toString())),
        ],
      }),
    });
    view.current = editor;
    if (autoFocus) editor.focus();
    return () => editor.destroy();
    // Created once; later `value`s go through the effect below.
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) replaceAll(editor, value);
  }, [value]);

  return <div className="query-editor" ref={host} />;
}

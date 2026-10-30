import { javascript } from "@codemirror/lang-javascript";
import { EditorState, type Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange?: (code: string) => void;
  /** Added on top of the shared setup; read once, when the editor is created. */
  extensions?: Extension[];
  /** The editor's view, for callers that act on it (diagnostics, selection…). */
  onView?: (view: EditorView) => void;
  readOnly?: boolean;
  autoFocus?: boolean;
  className: string;
}

const fillParent = EditorView.theme({ "&": { height: "100%" }, ".cm-scroller": { fontFamily: '"Cascadia Mono", Consolas, monospace' } });

const readOnlySetup = [EditorState.readOnly.of(true), EditorView.editable.of(false)];

export function replaceAll(view: EditorView, code: string) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
}

/** CodeMirror JavaScript editor in the app's theme. `value` changes from outside are applied in place. */
export function CodeEditor({ value, onChange, extensions = [], onView, readOnly, autoFocus, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changed = useRef(onChange);
  changed.current = onChange;

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          ...extensions,
          basicSetup,
          javascript(),
          oneDark,
          fillParent,
          readOnly ? readOnlySetup : [],
          EditorView.updateListener.of((u) => u.docChanged && changed.current?.(u.state.doc.toString())),
        ],
      }),
    });
    view.current = editor;
    onView?.(editor);
    if (autoFocus) editor.focus();
    return () => editor.destroy();
    // Created once; later `value`s go through the effect below.
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) replaceAll(editor, value);
  }, [value]);

  return <div className={className} ref={host} />;
}

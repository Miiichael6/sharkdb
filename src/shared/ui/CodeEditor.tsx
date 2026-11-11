import { EditorState, type Extension } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { codeTheme } from "./codeTheme";
import { shellJavascript } from "./shellLanguage";

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

// `userSelect`: the app turns selection off on <body>, which would also reach the editor's text.
const fillParent = EditorView.theme({ "&": { height: "100%", userSelect: "text" },".cm-scroller": { fontFamily: '"Fira Code", "Cascadia Mono", Consolas, monospace', fontVariantLigatures: "contextual" } });

// CodeMirror's own texts (search panel, go to line) in Spanish.
const spanish = EditorState.phrases.of({
  Find: "Buscar",
  Replace: "Reemplazar",
  next: "Siguiente",
  previous: "Anterior",
  all: "Todas",
  "match case": "Mayúsculas",
  regexp: "Regex",
  "by word": "Palabra completa",
  replace: "Reemplazar",
  "replace all": "Reemplazar todas",
  close: "Cerrar",
  "current match": "coincidencia actual",
  "on line": "en la línea",
  "replaced match on line $": "reemplazada la coincidencia de la línea $",
  "replaced $ matches": "$ coincidencias reemplazadas",
  "Go to line": "Ir a la línea",
  go: "Ir",
});

// Still focusable (only the text is locked), so Ctrl+F opens the search; without replace, as the text can't change.
const readOnlySetup = EditorState.readOnly.of(true);

export function replaceAll(view: EditorView, code: string) {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
}

/** CodeMirror JavaScript editor in the code theme. `value` changes from outside are applied in place. */
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
          // Tab/Shift+Tab indent instead of moving focus out; after `extensions`, so their Tab (accept suggestion) wins.
          keymap.of([indentWithTab]),
          shellJavascript(),
          codeTheme,
          fillParent,
          spanish,
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

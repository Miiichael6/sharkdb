// The script's error marked on its line of the editor: underlined, with an icon in the gutter whose
// tooltip is the message. It goes away as soon as the text changes.
import { diagnosticCount, lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { EditorState, type Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { scriptErrorText, type ScriptError } from "../domain/outcome";
import { editorLine } from "./revealLine";

/** The whole line `line` (kept inside the document) as an error saying `message`. */
export function lineDiagnostic(doc: Text, line: number, message: string): Diagnostic {
  const at = editorLine(doc, line);
  return { from: at.from, to: at.to, severity: "error", message };
}

/** Marks `error`'s line, or clears the mark when there is no error or it has no line (timeout, cancelled…). */
export function markError(view: EditorView, error: ScriptError | null) {
  const { doc } = view.state;
  const marks = error?.line ? [lineDiagnostic(doc, error.line, scriptErrorText(error))] : [];
  view.dispatch(setDiagnostics(view.state, marks));
}

/** An edit makes the mark stale, so it is dropped in the same transaction. */
const clearOnEdit = EditorState.transactionExtender.of((tr) =>
  tr.docChanged && diagnosticCount(tr.startState) > 0 ? setDiagnostics(tr.startState, []) : null,
);

/** Extensions the editor needs for `markError`: the gutter icon and the clearing on edit. */
export const errorMark = [lintGutter(), clearOnEdit];

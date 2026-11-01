import type { Line, Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** Line `line` of `doc`, kept inside the document. */
export const editorLine = (doc: Text, line: number): Line => doc.line(Math.min(Math.max(line, 1), doc.lines));

/** Puts the cursor at the start of `line` (kept inside the document), scrolls to it and focuses the editor. */
export function revealLine(view: EditorView, line: number) {
  const at = editorLine(view.state.doc, line).from;
  view.dispatch({ selection: { anchor: at }, effects: EditorView.scrollIntoView(at, { y: "center" }) });
  view.focus();
}

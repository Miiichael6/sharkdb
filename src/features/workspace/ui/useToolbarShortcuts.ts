import { useEffect, useRef } from "react";
import { actionForKey, type ToolbarActionId } from "../domain/toolbarActions";

export type ToolbarHandlers = Partial<Record<ToolbarActionId, () => void>>;

/** Selector of the script editor, which keeps the keys it uses itself (F5 runs the script). */
const EDITOR_SELECTOR = ".cm-editor";

/** Window-wide shortcuts of the toolbar actions (Ctrl+B, Ctrl+R / F5...). */
export function useToolbarShortcuts(handlers: ToolbarHandlers) {
  const current = useRef(handlers);
  current.current = handlers;

  useEffect(() => {
    const run = (e: KeyboardEvent, inEditor: boolean) => {
      const id = actionForKey(e, inEditor);
      const handler = id && current.current[id];
      if (!handler) return;
      e.preventDefault();
      e.stopPropagation();
      handler();
    };
    // In the editor the shortcuts that work there go first, before the editor's own binding
    // for the same keys (Ctrl+Shift+K deletes a line in CodeMirror).
    const onEditorKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest(EDITOR_SELECTOR)) run(e, true);
    };
    const onKey = (e: KeyboardEvent) => {
      // A focused widget (e.g. F5 in the explorer refreshes its node) already handled it.
      if (e.defaultPrevented) return;
      if (e.target instanceof Element && e.target.closest(EDITOR_SELECTOR)) return;
      run(e, false);
    };
    window.addEventListener("keydown", onEditorKey, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onEditorKey, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}

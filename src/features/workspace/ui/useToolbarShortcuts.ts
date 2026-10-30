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
    const onKey = (e: KeyboardEvent) => {
      // A focused widget (e.g. F5 in the explorer refreshes its node) already handled it.
      if (e.defaultPrevented) return;
      const inEditor = e.target instanceof Element && !!e.target.closest(EDITOR_SELECTOR);
      const id = actionForKey(e, inEditor);
      const run = id && current.current[id];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

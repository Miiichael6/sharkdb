import { useEffect, useRef } from "react";

export interface TabShortcutHandlers {
  newTab: () => void;
  closeTab: () => void;
  openFile: () => void;
  saveFile: (saveAs: boolean) => void;
}

/** Window-wide Ctrl+T (new tab), Ctrl+W (close), Ctrl+O (open script), Ctrl+S / Ctrl+Shift+S (save). */
export function useTabShortcuts(handlers: TabShortcutHandlers) {
  const current = useRef(handlers);
  current.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const h = current.current;
      switch (e.key.toLowerCase()) {
        case "t":
          h.newTab();
          break;
        case "w":
          h.closeTab();
          break;
        case "o":
          h.openFile();
          break;
        case "s":
          h.saveFile(e.shiftKey);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

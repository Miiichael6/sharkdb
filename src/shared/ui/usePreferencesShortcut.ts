import { useEffect } from "react";
import { openPreferencesWindow } from "./preferencesWindow";

const PREFERENCES_KEY = ",";

/** Ctrl+, opens "Preferencias" from anywhere in the window: the welcome screen, the workspace or the editor. */
export function usePreferencesShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== PREFERENCES_KEY || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      void openPreferencesWindow();
    };
    // Capture, so the script editor does not keep the key.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}

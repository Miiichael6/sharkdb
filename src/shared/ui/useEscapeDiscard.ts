import { useEffect, useRef } from "react";
import { discardChangesRequest } from "../domain/confirmation";
import { confirmInWindow } from "./confirmInWindow";

/**
 * Escape closes an editor window; with unsaved changes (`dirty`) it asks first, in its own window,
 * so a stray Escape doesn't throw away what was typed. `what` names the editor in the question.
 */
export function useEscapeDiscard(dirty: boolean, what: string, onClose: () => void) {
  const state = useRef({ dirty, what, onClose, asking: false });
  Object.assign(state.current, { dirty, what, onClose });

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const s = state.current;
      if (e.key !== "Escape" || s.asking) return;
      if (!s.dirty) return s.onClose();
      s.asking = true;
      try {
        if (await confirmInWindow(discardChangesRequest(s.what))) s.onClose();
      } finally {
        s.asking = false;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

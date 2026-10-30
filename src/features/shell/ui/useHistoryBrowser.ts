import { useCallback, useRef } from "react";
import { useServices } from "../../../app/services";
import { stepHistory } from "../domain/history";

/**
 * Ctrl+↑ / Ctrl+↓ through a connection's query history. The editor's text before browsing is
 * kept and comes back when stepping past the newest entry.
 */
export function useHistoryBrowser(connectionId: string) {
  const { history } = useServices();
  const position = useRef(-1);
  const draft = useRef("");

  /** Code to put in the editor, or null when there's nothing further that way. */
  const step = useCallback(
    async (direction: "older" | "newer", current: string): Promise<string | null> => {
      const entries = await history.entries(connectionId);
      const next = stepHistory(entries.length, position.current, direction);
      if (next === position.current) return null;
      if (position.current === -1) draft.current = current;
      position.current = next;
      return next === -1 ? draft.current : entries[next].code;
    },
    [history, connectionId],
  );

  /** Back to the editor's own text (after a run). */
  const reset = useCallback(() => {
    position.current = -1;
  }, []);

  return { step, reset };
}

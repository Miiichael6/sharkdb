import { useCallback, useState } from "react";
import { errorMessage } from "../../../shared/errors";
import { askOpener } from "../../../shared/ui/modalWindow";
import type { Session } from "../../connections/domain/session";
import { SYNC_VIEW } from "./syncViews";

/**
 * The open connections as the sync window sees them. A closed one is connected by the main window
 * (asked with its id), so it appears in the tree as if it had been opened by hand.
 */
export function useSyncConnections(initial: Session[]) {
  const [sessions, setSessions] = useState(initial);
  const [connecting, setConnecting] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setConnectingId = (id: string, on: boolean) =>
    setConnecting((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const ensureConnected = useCallback(
    (id: string) => {
      // A failed one isn't retried on its own: choosing it again does (`clearError`).
      if (!id || sessions.some((s) => s.conn.id === id) || connecting.has(id) || id in errors) return;
      setConnectingId(id, true);
      askOpener<Session>(SYNC_VIEW, id)
        .then(
          (session) => setSessions((current) => [...current.filter((s) => s.conn.id !== id), session]),
          (e) => setErrors((current) => ({ ...current, [id]: errorMessage(e) })),
        )
        .finally(() => setConnectingId(id, false));
    },
    [sessions, connecting, errors],
  );

  const clearError = (id: string) => setErrors(({ [id]: _, ...rest }) => rest);

  return { sessions, connecting, errors, ensureConnected, clearError };
}

import { useCallback, useState } from "react";
import { errorMessage } from "../../../shared/errors";
import { askOpener } from "../../../shared/ui/modalWindow";
import type { Session } from "../domain/session";

/** How one chosen connection is doing. */
export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: string;
}

/**
 * The open connections as a selection window (`view`) sees them. A closed one is opened apart by the main
 * window (asked with its id): the explorer doesn't show it and it closes once the operation is done.
 */
export function useConnectionsOnDemand(view: string, initial: Session[]) {
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
      askOpener<Session>(view, id)
        .then(
          (session) => setSessions((current) => [...current.filter((s) => s.conn.id !== id), session]),
          (e) => setErrors((current) => ({ ...current, [id]: errorMessage(e) })),
        )
        .finally(() => setConnectingId(id, false));
    },
    [view, sessions, connecting, errors],
  );

  const clearError = (id: string) => setErrors(({ [id]: _, ...rest }) => rest);

  const status = (id: string): ConnectionStatus => ({
    connected: sessions.some((s) => s.conn.id === id),
    connecting: connecting.has(id),
    error: errors[id] ?? "",
  });

  /** Databases connection `id` has now, to tell what is replaced from what is created. */
  const databasesOf = (id: string) => sessions.find((s) => s.conn.id === id)?.info.databases.map((d) => d.name) ?? [];

  return { sessions, ensureConnected, clearError, status, databasesOf };
}

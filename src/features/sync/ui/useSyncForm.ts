import { useEffect, useState } from "react";
import { pickTarget, requestSelection, syncSources, syncTargets, type Selection } from "../domain/syncPlan";
import type { SyncWindowData } from "./syncViews";
import { useSyncConnections } from "./useSyncConnections";

/**
 * State of the selection window: source, destination and the chosen collections. Each end is chosen
 * among the registered connections, never the other end's, and gets connected when it's closed.
 */
export function useSyncForm({ connections, sessions: openSessions, origin, initial }: SyncWindowData) {
  const { sessions, connecting, errors, ensureConnected, clearError } = useSyncConnections(openSessions);
  const [sourceId, setSourceId] = useState(initial?.sourceSid ?? origin.sid);
  const [chosenTargetId, setChosenTargetId] = useState(initial?.targetSid ?? "");
  const [selection, setSelection] = useState<Selection>(() => (initial ? requestSelection(initial) : {}));

  const targets = syncTargets(connections, sessions, sourceId);
  // The chosen destination, or another one when it's no longer offered.
  const targetId = pickTarget(targets, chosenTargetId);
  const sources = syncSources(connections, sessions, targetId);

  useEffect(() => ensureConnected(sourceId), [ensureConnected, sourceId]);
  useEffect(() => ensureConnected(targetId), [ensureConnected, targetId]);

  const changeSource = (id: string) => {
    clearError(id);
    setSourceId(id);
    setSelection({});
  };
  const changeTarget = (id: string) => {
    clearError(id);
    setChosenTargetId(id);
  };

  const status = (id: string) => ({
    connected: sessions.some((s) => s.conn.id === id),
    connecting: connecting.has(id),
    error: errors[id] ?? "",
  });
  return {
    sources,
    targets,
    source: sources.find((s) => s.id === sourceId),
    target: targets.find((t) => t.id === targetId),
    sourceId,
    targetId,
    sourceStatus: status(sourceId),
    targetStatus: status(targetId),
    /** Databases the destination has now, to tell what is replaced from what is created. */
    targetDatabases: sessions.find((s) => s.conn.id === targetId)?.info.databases.map((d) => d.name) ?? [],
    changeSource,
    changeTarget,
    selection,
    setSelection,
  };
}

import { useEffect, useState } from "react";
import { selectionOf, type Selection } from "../../../shared/domain/selection";
import { pickTarget, sourceOptions, targetOptions } from "../../connections/domain/endpoints";
import { useConnectionsOnDemand } from "../../connections/ui/useConnectionsOnDemand";
import { SYNC_VIEW, type SyncWindowData } from "./syncViews";

/**
 * State of the selection window: source, destination and the chosen collections. Both ends are chosen
 * among the registered connections (the destination never is the source) and get connected when closed.
 */
export function useSyncForm({ connections, sessions: openSessions, origin, initial }: SyncWindowData) {
  const { sessions, ensureConnected, clearError, status, databasesOf } = useConnectionsOnDemand(SYNC_VIEW, openSessions);
  const [sourceId, setSourceId] = useState(initial?.sourceSid ?? origin.sid);
  const [chosenTargetId, setChosenTargetId] = useState(initial?.targetSid ?? "");
  const [selection, setSelection] = useState<Selection>(() => (initial ? selectionOf(initial.databases) : {}));

  const targets = targetOptions(connections, sessions, sourceId);
  // The chosen destination, or another one when it's no longer offered (e.g. it was made the source).
  const targetId = pickTarget(targets, chosenTargetId);
  const sources = sourceOptions(connections, sessions);

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

  return {
    sources,
    targets,
    source: sources.find((s) => s.id === sourceId),
    target: targets.find((t) => t.id === targetId),
    sourceId,
    targetId,
    sourceStatus: status(sourceId),
    targetStatus: status(targetId),
    targetDatabases: databasesOf(targetId),
    changeSource,
    changeTarget,
    selection,
    setSelection,
  };
}

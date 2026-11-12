import { useEffect, useState } from "react";
import { pickTarget } from "../../connections/domain/endpoints";
import { useConnectionsOnDemand } from "../../connections/ui/useConnectionsOnDemand";
import { documentSyncTargets } from "../domain/documentSync";
import { DOCUMENT_SYNC_VIEW, type DocumentSyncWindowData } from "./documentSyncViews";

/**
 * State of the document sync's selection window: the source is fixed and the destination is chosen
 * among the connections of a lower environment (D26), connected when it's closed.
 */
export function useDocumentSyncForm({ connections, sessions: openSessions, source, initialTargetSid }: DocumentSyncWindowData) {
  const { sessions, ensureConnected, clearError, status } = useConnectionsOnDemand(DOCUMENT_SYNC_VIEW, openSessions);
  const [chosenTargetId, setChosenTargetId] = useState(initialTargetSid ?? "");

  const targets = documentSyncTargets(connections, sessions, source.sid);
  const targetId = pickTarget(targets, chosenTargetId);

  useEffect(() => ensureConnected(targetId), [ensureConnected, targetId]);

  const changeTarget = (id: string) => {
    clearError(id);
    setChosenTargetId(id);
  };

  const target = targets.find((t) => t.id === targetId);
  const targetStatus = status(targetId);
  return {
    targets,
    target,
    targetId,
    targetStatus,
    changeTarget,
    ready: !!target && !target.blocked && targetStatus.connected,
  };
}

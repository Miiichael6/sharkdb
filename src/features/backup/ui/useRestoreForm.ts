import { useEffect, useState } from "react";
import { selectionOf, type Selection } from "../../../shared/domain/selection";
import { neverModifiedAmong, type MongoConnection } from "../../connections/domain/connection";
import { pickTarget, targetOptions } from "../../connections/domain/endpoints";
import { useConnectionsOnDemand } from "../../connections/ui/useConnectionsOnDemand";
import { RESTORE_VIEW, type RestoreWindowData } from "./backupViews";

/**
 * State of the restore window: the backup folder, the destination (connected when closed; a protected
 * or production one is offered, marked, but never chosen for the user) and the chosen collections.
 */
export function useRestoreForm({ connections, sessions: openSessions, origin, initial }: RestoreWindowData) {
  const { sessions, ensureConnected, clearError, status, databasesOf } = useConnectionsOnDemand(RESTORE_VIEW, openSessions);
  const [dir, setDir] = useState(initial?.dir ?? "");
  // The folder whose databases are shown: read when picked, or when the typed one is left.
  const [folder, setFolder] = useState(initial?.dir ?? "");
  // Opened from a production connection, it doesn't start with it as destination: it has to be chosen.
  const [chosenTargetId, setChosenTargetId] = useState(() => initial?.targetSid ?? (isProduction(connections, origin.sid) ? "" : origin.sid));
  const [selection, setSelection] = useState<Selection>(() => (initial ? selectionOf(initial.databases) : {}));

  const targets = targetOptions(connections, sessions, "", true);
  // The chosen destination, or another one when it can't be written to.
  const targetId = pickTarget(targets, chosenTargetId);
  useEffect(() => ensureConnected(targetId), [ensureConnected, targetId]);

  const readFolder = (next: string) => {
    setDir(next);
    const trimmed = next.trim();
    if (trimmed === folder) return;
    setFolder(trimmed);
    setSelection({});
  };
  const changeTarget = (id: string) => {
    clearError(id);
    setChosenTargetId(id);
  };

  return {
    dir,
    setDir,
    folder,
    readFolder,
    targets,
    target: targets.find((t) => t.id === targetId),
    targetId,
    targetStatus: status(targetId),
    targetDatabases: databasesOf(targetId),
    changeTarget,
    selection,
    setSelection,
  };
}

function isProduction(connections: MongoConnection[], id: string): boolean {
  const conn = connections.find((c) => c.id === id);
  return !!conn && neverModifiedAmong(conn, connections);
}

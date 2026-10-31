import { useEffect, useState } from "react";
import { selectionOf, type Selection } from "../../../shared/domain/selection";
import { pickTarget, targetOptions } from "../../connections/domain/endpoints";
import { useConnectionsOnDemand } from "../../connections/ui/useConnectionsOnDemand";
import { RESTORE_VIEW, type RestoreWindowData } from "./backupViews";

/**
 * State of the restore window: the backup folder, the destination (never a protected or production
 * connection, connected when closed) and the chosen collections.
 */
export function useRestoreForm({ connections, sessions: openSessions, origin, initial }: RestoreWindowData) {
  const { sessions, ensureConnected, clearError, status, databasesOf } = useConnectionsOnDemand(RESTORE_VIEW, openSessions);
  const [dir, setDir] = useState(initial?.dir ?? "");
  // The folder whose databases are shown: read when picked, or when the typed one is left.
  const [folder, setFolder] = useState(initial?.dir ?? "");
  const [chosenTargetId, setChosenTargetId] = useState(initial?.targetSid ?? origin.sid);
  const [selection, setSelection] = useState<Selection>(() => (initial ? selectionOf(initial.databases) : {}));

  const targets = targetOptions(connections, sessions);
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

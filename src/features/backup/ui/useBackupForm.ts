import { useEffect, useState } from "react";
import { selectionOf, type Selection } from "../../../shared/domain/selection";
import { sourceOptions } from "../../connections/domain/endpoints";
import { useConnectionsOnDemand } from "../../connections/ui/useConnectionsOnDemand";
import { BACKUP_VIEW, type BackupWindowData } from "./backupViews";

/** State of the backup window: the connection to read (connected when closed), the folder and the chosen collections. */
export function useBackupForm({ connections, sessions: openSessions, origin, initial }: BackupWindowData) {
  const { sessions, ensureConnected, clearError, status } = useConnectionsOnDemand(BACKUP_VIEW, openSessions);
  const [sourceId, setSourceId] = useState(initial?.sid ?? origin.sid);
  const [dir, setDir] = useState(initial?.dir ?? "");
  const [selection, setSelection] = useState<Selection>(() => (initial ? selectionOf(initial.databases) : {}));

  const sources = sourceOptions(connections, sessions);
  useEffect(() => ensureConnected(sourceId), [ensureConnected, sourceId]);

  const changeSource = (id: string) => {
    clearError(id);
    setSourceId(id);
    setSelection({});
  };

  return {
    sources,
    source: sources.find((s) => s.id === sourceId),
    sourceId,
    sourceStatus: status(sourceId),
    changeSource,
    dir,
    setDir,
    selection,
    setSelection,
  };
}

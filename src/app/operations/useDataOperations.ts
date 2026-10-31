// Sync, backup and restore as background operations: what each one shows in the panel and notifies at the end.
import { backupSummary, restoreSummary, type BackupRequest, type RestoreRequest } from "../../features/backup/domain/backupSpec";
import { displayName } from "../../features/connections/domain/connection";
import type { Session } from "../../features/connections/domain/session";
import { syncSummary, type SyncRequest } from "../../features/sync/domain/syncPlan";
import type { StartedOperation } from "../../shared/application/operationsService";
import type { OperationEndpoint } from "../../shared/domain/operations";
import { useServices } from "../services";
import { useOperations } from "./useOperations";

/**
 * Launchers of the data operations. `onTargetChanged` runs once an operation that writes ends, however
 * it ends: a cancelled sync or restore may already have changed some collections.
 */
export function useDataOperations(sessions: Session[], onTargetChanged: () => void) {
  const { sync, backup } = useServices();
  const { start } = useOperations();

  const connection = (sid: string): OperationEndpoint => {
    const session = sessions.find((s) => s.conn.id === sid);
    return session ? { name: displayName(session.conn), tag: session.conn.tag } : { name: sid };
  };
  const refreshAtEnd = (started: StartedOperation | null) => void started?.settled.then(onTargetChanged);

  return {
    sync(request: SyncRequest) {
      const target = connection(request.targetSid);
      const spec = { kind: "sync", title: "Sincronizar", source: connection(request.sourceSid), target, writesTo: request.targetSid } as const;
      refreshAtEnd(
        start(spec, (onProgress) => sync.sync(request, onProgress), (results) => syncSummary(target.name, request.databases.length, results)),
      );
    },
    backup(request: BackupRequest) {
      const spec = { kind: "backup", title: `Backup de ${request.db}`, source: connection(request.sid), target: { name: request.dir } } as const;
      start(spec, (onProgress) => backup.backup(request, onProgress), (results) => backupSummary(request.db, results));
    },
    restore(request: RestoreRequest) {
      const target = connection(request.sid);
      const spec = { kind: "restore", title: `Restaurar ${request.db}`, source: { name: request.dir }, target, writesTo: request.sid } as const;
      refreshAtEnd(
        start(spec, (onProgress) => backup.restore(request, onProgress), (results) => `${restoreSummary(request.db, results)} · ${target.name}`),
      );
    },
  };
}

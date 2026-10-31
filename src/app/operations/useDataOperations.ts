// Sync, backup and restore as background operations: what each one shows in the panel and notifies at the end.
import { backupSummary, restoreSummary, type BackupRequest, type RestoreRequest } from "../../features/backup/domain/backupSpec";
import type { MongoConnection } from "../../features/connections/domain/connection";
import { connectionEndpoint } from "../../features/connections/domain/endpoints";
import { syncSummary, type SyncRequest } from "../../features/sync/domain/syncPlan";
import type { StartedOperation } from "../../shared/application/operationsService";
import { busyTargetMessage, folderEndpoint, runningOn, type OperationEndpoint } from "../../shared/domain/operations";
import { useServices } from "../services";
import { useOperations } from "./useOperations";

/**
 * Launchers of the data operations; each returns a promise that settles when the operation ends, or
 * nothing when it didn't start. `onTargetChanged` runs once an operation that writes ends, however it
 * ends: a cancelled sync or restore may already have changed some collections.
 */
export function useDataOperations(connections: MongoConnection[], onTargetChanged: () => void) {
  const { sync, backup, operations } = useServices();
  const { start } = useOperations();

  // Registered connections, not sessions: a sync may have just connected its ends.
  const connection = (sid: string): OperationEndpoint => connectionEndpoint(connections, sid);
  const refreshAtEnd = (started: StartedOperation | null) => started?.settled.then(onTargetChanged);

  return {
    /** Why nothing can start writing to `sid` now: another operation already writes there. */
    busyReason(sid: string) {
      return runningOn(operations.list(), sid) ? busyTargetMessage(connection(sid).name) : undefined;
    },
    sync(request: SyncRequest) {
      const target = connection(request.targetSid);
      const spec = { kind: "sync", title: "Sincronizar", source: connection(request.sourceSid), target, writesTo: request.targetSid } as const;
      return refreshAtEnd(
        start(spec, (onProgress) => sync.sync(request, onProgress), (results) => syncSummary(target.name, request.databases.length, results)),
      );
    },
    backup(request: BackupRequest) {
      const spec = { kind: "backup", title: "Backup", source: connection(request.sid), target: folderEndpoint(request.dir) } as const;
      return start(
        spec,
        (onProgress) => backup.backup(request, onProgress),
        (results) => backupSummary(request.dir, request.databases.length, results),
      )?.settled;
    },
    restore(request: RestoreRequest) {
      const target = connection(request.targetSid);
      const spec = { kind: "restore", title: "Restaurar", source: folderEndpoint(request.dir), target, writesTo: request.targetSid } as const;
      return refreshAtEnd(
        start(
          spec,
          (onProgress) => backup.restore(request, onProgress),
          (results) => restoreSummary(target.name, request.databases.length, results),
        ),
      );
    },
  };
}

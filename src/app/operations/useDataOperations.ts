// Sync, backup and restore as background operations: what each one shows in the panel and notifies at the end.
import { backupSummary, restoreSummary, type BackupRequest, type RestoreRequest } from "../../features/backup/domain/backupSpec";
import type { MongoConnection } from "../../features/connections/domain/connection";
import { connectionEndpoint } from "../../features/connections/domain/endpoints";
import { documentSyncSelection, documentSyncSummary, type DocumentSyncRequest } from "../../features/sync/domain/documentSync";
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
  const { start, cancel, operations: list } = useOperations();

  // Registered connections, not sessions: a sync may have just connected its ends.
  const connection = (sid: string): OperationEndpoint => connectionEndpoint(connections, sid);
  const refreshAtEnd = (started: StartedOperation | null) => started?.settled.then(onTargetChanged);
  const startBackup = (request: BackupRequest) => {
    const spec = {
      kind: "backup",
      title: "Backup",
      source: connection(request.sid),
      target: folderEndpoint(request.dir),
      databases: request.databases,
    } as const;
    return start(
      spec,
      (listener) => backup.backup(request, listener),
      (results) => backupSummary(request.dir, request.databases.length, results),
    );
  };

  return {
    /**
     * Why nothing can start writing to `sid` now: another window has an operation running (error 60),
     * or another operation already writes there.
     */
    busyReason(sid: string) {
      return operations.busyElsewhere() ?? (runningOn(operations.list(), sid) ? busyTargetMessage(connection(sid).name) : undefined);
    },
    /** Why nothing can start now: another window has an operation running (error 60). */
    busyElsewhere: () => operations.busyElsewhere(),
    sync(request: SyncRequest) {
      const target = connection(request.targetSid);
      const spec = {
        kind: "sync",
        title: "Sincronizar",
        source: connection(request.sourceSid),
        target,
        writesTo: request.targetSid,
        databases: request.databases,
      } as const;
      return refreshAtEnd(
        start(spec, (listener) => sync.sync(request, listener), (results) => syncSummary(target.name, request.databases.length, results)),
      );
    },
    /** Documents picked in the viewer, to a lower environment (R97–R100); listed under Sync in the panel. */
    syncDocuments(request: DocumentSyncRequest) {
      const target = connection(request.targetSid);
      const spec = {
        kind: "sync",
        title: "Sincronizar documentos",
        source: connection(request.sourceSid),
        target,
        writesTo: request.targetSid,
        databases: documentSyncSelection(request),
      } as const;
      return refreshAtEnd(
        start(
          spec,
          (listener) => sync.syncDocuments(request, connections, listener),
          (results) => documentSyncSummary(target.name, request, results),
        ),
      );
    },
    /** The backup as an operation, to follow or cancel it; null when it didn't start. */
    startBackup,
    backup: (request: BackupRequest) => startBackup(request)?.settled,
    /** Cancels operation `id`, once confirmed, if it's still there. */
    cancel(id: string) {
      const op = list.find((o) => o.id === id);
      return op ? cancel(op) : Promise.resolve();
    },
    restore(request: RestoreRequest) {
      const target = connection(request.targetSid);
      const spec = {
        kind: "restore",
        title: "Restaurar",
        source: folderEndpoint(request.dir),
        target,
        writesTo: request.targetSid,
        databases: request.databases,
      } as const;
      return refreshAtEnd(
        start(
          spec,
          (listener) => backup.restore(request, listener),
          (results) => restoreSummary(target.name, request.databases.length, results),
        ),
      );
    },
  };
}

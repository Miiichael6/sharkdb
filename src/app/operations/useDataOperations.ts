// Sync, backup and restore as background operations: what each one shows in the panel and notifies at the end.
import { backupSummary, restoreSummary, type BackupRequest, type RestoreRequest } from "../../features/backup/domain/backupSpec";
import type { MongoConnection } from "../../features/connections/domain/connection";
import { connectionEndpoint } from "../../features/connections/domain/endpoints";
import { DOCUMENT_SYNC_CANCEL_EFFECT, documentSyncSelection, documentSyncSummary, type DocumentSyncRequest } from "../../features/sync/domain/documentSync";
import { syncSummary, type SyncRequest } from "../../features/sync/domain/syncPlan";
import type { StartedOperation } from "../../shared/application/operationsService";
import {
  busyTargetMessage,
  connectionInUseMessage,
  folderEndpoint,
  runningOn,
  runningWith,
  type ConnectionClosing,
  type OperationEndpoint,
} from "../../shared/domain/operations";
import { useServices } from "../services";
import type { DataRequest } from "./dataRequest";
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
  const refreshAtEnd = (started: StartedOperation | null) => {
    void started?.settled.then(onTargetChanged);
    return started;
  };

  const startBackup = (request: BackupRequest) => {
    const spec = {
      kind: "backup",
      title: "Backup",
      source: connection(request.sid),
      readsFrom: request.sid,
      target: folderEndpoint(request.dir),
      databases: request.databases,
      request: { type: "backup", request } satisfies DataRequest,
    } as const;
    return start(
      spec,
      (listener) => backup.backup(request, listener),
      (results) => backupSummary(request.dir, request.databases.length, results),
    );
  };

  const startSync = (request: SyncRequest) => {
    const target = connection(request.targetSid);
    const spec = {
      kind: "sync",
      title: "Sincronizar",
      source: connection(request.sourceSid),
      readsFrom: request.sourceSid,
      target,
      writesTo: request.targetSid,
      databases: request.databases,
      request: { type: "sync", request } satisfies DataRequest,
    } as const;
    return refreshAtEnd(
      start(spec, (listener) => sync.sync(request, listener), (results) => syncSummary(target.name, request.databases.length, results)),
    );
  };

  const startDocumentSync = (request: DocumentSyncRequest) => {
    const target = connection(request.targetSid);
    const spec = {
      kind: "sync",
      title: "Sincronizar documentos",
      source: connection(request.sourceSid),
      readsFrom: request.sourceSid,
      target,
      writesTo: request.targetSid,
      databases: documentSyncSelection(request),
      request: { type: "documents", request } satisfies DataRequest,
      cancelEffect: DOCUMENT_SYNC_CANCEL_EFFECT,
    } as const;
    return refreshAtEnd(
      start(
        spec,
        (listener) => sync.syncDocuments(request, connections, listener),
        (results) => documentSyncSummary(target.name, request, results),
      ),
    );
  };

  const startRestore = (request: RestoreRequest) => {
    const target = connection(request.targetSid);
    const spec = {
      kind: "restore",
      title: "Restaurar",
      source: folderEndpoint(request.dir),
      target,
      writesTo: request.targetSid,
      databases: request.databases,
      request: { type: "restore", request } satisfies DataRequest,
    } as const;
    return refreshAtEnd(
      start(
        spec,
        (listener) => backup.restore(request, listener),
        (results) => restoreSummary(target.name, request.databases.length, results),
      ),
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
    /** Why connection `sid` can't be disconnected, edited or deleted now: a running operation uses it. */
    inUse(sid: string, action: ConnectionClosing) {
      const op = runningWith(operations.list(), sid);
      return op && connectionInUseMessage(connection(sid).name, op, action);
    },
    /** Why nothing can start now: another window has an operation running (error 60). */
    busyElsewhere: () => operations.busyElsewhere(),
    sync: (request: SyncRequest) => startSync(request)?.settled,
    /** Documents picked in the viewer, to a lower environment (R97–R100); listed under Sync in the panel. */
    syncDocuments: (request: DocumentSyncRequest) => startDocumentSync(request)?.settled,
    /** The backup as an operation, to follow or cancel it; null when it didn't start. */
    startBackup,
    backup: (request: BackupRequest) => startBackup(request)?.settled,
    /** Cancels operation `id`, once confirmed, if it's still there. */
    cancel(id: string) {
      const op = list.find((o) => o.id === id);
      return op ? cancel(op) : Promise.resolve();
    },
    restore: (request: RestoreRequest) => startRestore(request)?.settled,
    /** Launches `data` again as a new operation (R102); null when it didn't start. */
    relaunch(data: DataRequest): StartedOperation | null {
      switch (data.type) {
        case "sync":
          return startSync(data.request);
        case "documents":
          return startDocumentSync(data.request);
        case "backup":
          return startBackup(data.request);
        case "restore":
          return startRestore(data.request);
      }
    },
  };
}

// What launched each data operation, kept in it to launch it again (R101–R103).
import type { BackupRequest, RestoreRequest } from "../../features/backup/domain/backupSpec";
import { neverModifiedAmong, type MongoConnection } from "../../features/connections/domain/connection";
import { PROTECTED_TARGET, SAFE_MODE_TARGET } from "../../features/connections/domain/endpoints";
import type { Session } from "../../features/connections/domain/session";
import type { DocumentSyncRequest } from "../../features/sync/domain/documentSync";
import type { SyncRequest } from "../../features/sync/domain/syncPlan";

export type DataRequest =
  | { type: "sync"; request: SyncRequest }
  | { type: "documents"; request: DocumentSyncRequest }
  | { type: "backup"; request: BackupRequest }
  | { type: "restore"; request: RestoreRequest };

const DATA_REQUEST_TYPES: ReadonlyArray<DataRequest["type"]> = ["sync", "documents", "backup", "restore"];

/** Whether an operation's stored `request` is one of these (it crossed windows as plain JSON). */
export const isDataRequest = (value: unknown): value is DataRequest =>
  !!value &&
  typeof value === "object" &&
  DATA_REQUEST_TYPES.includes((value as DataRequest).type) &&
  typeof (value as DataRequest).request === "object";

/** Connection it writes to; a backup only reads, so it has none. */
export function writtenConnection(data: DataRequest): string | undefined {
  return data.type === "backup" ? undefined : data.request.targetSid;
}

/** Connections it needs open while it runs: the ones it reads from and the one it writes to. */
export function usedConnections(data: DataRequest): string[] {
  switch (data.type) {
    case "sync":
    case "documents":
      return [data.request.sourceSid, data.request.targetSid];
    case "backup":
      return [data.request.sid];
    case "restore":
      return [data.request.targetSid];
  }
}

/**
 * Why it can't write where it goes now (R103), or undefined when it can. A destination that became
 * protected or production meanwhile is never written to, unless it was a restore whose name was
 * typed to confirm it; safe mode always holds it back.
 */
export function retryBlockReason(data: DataRequest, connections: MongoConnection[], target: Session | undefined): string | undefined {
  if (!target) return undefined;
  const allowProduction = data.type === "restore" && !!data.request.confirmProtected;
  // As registered now: an open session keeps the settings it was opened with.
  const conn = connections.find((c) => c.id === target.conn.id) ?? target.conn;
  if (!allowProduction && neverModifiedAmong(conn, connections)) return PROTECTED_TARGET;
  if (target.safeMode) return SAFE_MODE_TARGET;
  return undefined;
}

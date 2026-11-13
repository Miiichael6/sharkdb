// What launched each data operation, kept in it to launch it again (R101–R103).
import type { BackupRequest, RestoreRequest } from "../../features/backup/domain/backupSpec";
import { displayName, neverModifiedAmong, serverAddresses, type MongoConnection } from "../../features/connections/domain/connection";
import { PROTECTED_TARGET, SAFE_MODE_TARGET } from "../../features/connections/domain/endpoints";
import type { Session } from "../../features/connections/domain/session";
import type { DocumentSyncRequest } from "../../features/sync/domain/documentSync";
import type { SyncRequest } from "../../features/sync/domain/syncPlan";

type DataRequestBody =
  | { type: "sync"; request: SyncRequest }
  | { type: "documents"; request: DocumentSyncRequest }
  | { type: "backup"; request: BackupRequest }
  | { type: "restore"; request: RestoreRequest };

/**
 * The request and, for each connection it uses, how that connection was when it was confirmed
 * (`connectionFingerprint`): a retry doesn't ask the confirmation word again, so it only goes where it was confirmed.
 */
export type DataRequest = DataRequestBody & { fingerprints: Record<string, string> };

const DATA_REQUEST_TYPES: ReadonlyArray<DataRequest["type"]> = ["sync", "documents", "backup", "restore"];

export const CONNECTION_GONE = "Una conexión de la operación ya no está registrada: lánzala de nuevo desde el principio";
export const TARGET_NOT_OPEN = "No se pudo abrir la conexión de destino para comprobar que se puede escribir en ella";
export const connectionChanged = (conn: MongoConnection) =>
  `${displayName(conn)} cambió (servidor, entorno o protección) desde que se confirmó la operación: lánzala de nuevo para confirmarla otra vez`;

/** What makes a connection another place to read from or write to: its server, environment and protection. */
export function connectionFingerprint(conn: MongoConnection): string {
  return JSON.stringify({ addresses: [...serverAddresses(conn)].sort(), tag: conn.tag, protected: conn.protected });
}

/** `body` with the fingerprint of each connection it uses, as registered now. */
export function dataRequest(body: DataRequestBody, connections: MongoConnection[]): DataRequest {
  const fingerprints: Record<string, string> = {};
  for (const id of usedConnections(body)) {
    const conn = connections.find((c) => c.id === id);
    if (conn) fingerprints[id] = connectionFingerprint(conn);
  }
  return { ...body, fingerprints };
}

/** Whether an operation's stored `request` is one of these (it crossed windows as plain JSON). */
export const isDataRequest = (value: unknown): value is DataRequest =>
  !!value &&
  typeof value === "object" &&
  DATA_REQUEST_TYPES.includes((value as DataRequest).type) &&
  typeof (value as DataRequest).request === "object" &&
  typeof (value as DataRequest).fingerprints === "object" &&
  (value as DataRequest).fingerprints !== null;

/** Connection it writes to; a backup only reads, so it has none. */
export function writtenConnection(data: DataRequestBody): string | undefined {
  return data.type === "backup" ? undefined : data.request.targetSid;
}

/** Connections it needs open while it runs: the ones it reads from and the one it writes to. */
export function usedConnections(data: DataRequestBody): string[] {
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
 * Why a connection it uses is no longer the one confirmed, or undefined when all are the same: removed,
 * or edited to another server, environment or protection. Checked before connecting to any of them.
 */
export function staleReason(data: DataRequest, connections: MongoConnection[]): string | undefined {
  for (const id of usedConnections(data)) {
    const conn = connections.find((c) => c.id === id);
    if (!conn || !(id in data.fingerprints)) return CONNECTION_GONE;
    if (data.fingerprints[id] !== connectionFingerprint(conn)) return connectionChanged(conn);
  }
  return undefined;
}

/**
 * Why it can't write where it goes now (R103), or undefined when it can. A destination that became
 * protected or production meanwhile is never written to; a production restore whose name was typed
 * is only let through while the destination is the same one confirmed. Safe mode always holds it back,
 * and a destination it couldn't open is never taken as writable.
 */
export function retryBlockReason(data: DataRequest, connections: MongoConnection[], sessions: Session[]): string | undefined {
  const stale = staleReason(data, connections);
  if (stale) return stale;
  const targetId = writtenConnection(data);
  if (!targetId) return undefined;
  const target = sessions.find((s) => s.conn.id === targetId);
  if (!target) return TARGET_NOT_OPEN;
  const allowProduction = data.type === "restore" && !!data.request.confirmProtected;
  // As registered now: an open session keeps the settings it was opened with.
  const conn = connections.find((c) => c.id === targetId) ?? target.conn;
  if (!allowProduction && neverModifiedAmong(conn, connections)) return PROTECTED_TARGET;
  if (target.safeMode) return SAFE_MODE_TARGET;
  return undefined;
}

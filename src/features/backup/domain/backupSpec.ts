// Backup and restore of a database in the mongodump format (one folder per database).
import { displayName } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import { INVALID_DB_NAME, isValidDbName } from "../../explorer/domain/copySpec";

export interface BackupRequest {
  sid: string;
  db: string;
  collections: string[];
  /** Folder of the database (`<output>/<db>`), as mongodump leaves it. */
  dir: string;
}

export interface RestoreRequest {
  /** Destination connection and database. */
  sid: string;
  db: string;
  dir: string;
  collections: string[];
  /** Drop each collection before restoring it; otherwise documents with an existing `_id` are skipped. */
  dropBefore: boolean;
}

/** A collection found in a backup folder. */
export interface BackupEntry {
  collection: string;
  bytes: number;
  hasMetadata: boolean;
}

/** Progress of a running job. `done`/`total` count documents in a backup and bytes in a restore. */
export interface JobProgress {
  job: string;
  collection: string;
  /** Position of the current collection (from 0) and how many there are. */
  index: number;
  count: number;
  done: number;
  total: number;
}

export interface CollectionResult {
  collection: string;
  documents: number;
  /** Documents not restored because their `_id` already existed. */
  duplicates: number;
  indexes: number;
}

export const FOLDER_REQUIRED = "Elige una carpeta";
export const COLLECTIONS_REQUIRED = "Elige al menos una colección";
export const TARGET_DB_REQUIRED = "Indica la base de datos de destino";
export const PROTECTED_TARGET = "Conexión protegida: no se restaura sobre ella";
export const SAFE_MODE_TARGET = "Safe mode activo: desactívalo para restaurar";

const SEPARATORS = /[\\/]+$/;

/** Folder a database is saved in: `<parent>/<db>`, with the separator `parent` already uses. */
export function backupDir(parent: string, db: string): string {
  const base = parent.trim().replace(SEPARATORS, "");
  const separator = base.includes("\\") ? "\\" : "/";
  return `${base}${separator}${db}`;
}

/** Last segment of a folder: the database a mongodump folder was made from. */
export const folderName = (dir: string) => dir.trim().replace(SEPARATORS, "").split(/[\\/]/).pop() ?? "";

/** Overall progress of a job, 0–100: whole collections done plus the share of the current one. */
export function progressPercent(p: Pick<JobProgress, "index" | "count" | "done" | "total">): number {
  if (p.count <= 0) return 0;
  const current = p.total > 0 ? Math.min(p.done / p.total, 1) : 0;
  return Math.round(((p.index + current) / p.count) * 100);
}

function requireCommon(dir: string, collections: string[]): string {
  const trimmed = dir.trim();
  if (!trimmed) throw FOLDER_REQUIRED;
  if (!collections.length) throw COLLECTIONS_REQUIRED;
  return trimmed;
}

/** Checks a backup and trims its folder. Throws the message to show. */
export function validateBackup(r: BackupRequest): BackupRequest {
  return { ...r, dir: requireCommon(r.dir, r.collections) };
}

/** Checks a restore and trims its folder and database. Throws the message to show. */
export function validateRestore(r: RestoreRequest): RestoreRequest {
  const dir = requireCommon(r.dir, r.collections);
  const db = r.db.trim();
  if (!db) throw TARGET_DB_REQUIRED;
  if (!isValidDbName(db)) throw INVALID_DB_NAME;
  return { ...r, dir, db };
}

/** Why a session can't be a restore destination (D5, D7), or undefined when it can. */
export function restoreBlockReason(session: Session): string | undefined {
  if (session.conn.protected) return PROTECTED_TARGET;
  if (session.safeMode) return SAFE_MODE_TARGET;
  return undefined;
}

/** Sessions offered as restore destination, with the reason when they can't be one. */
export const restoreTargets = (sessions: Session[]) =>
  sessions.map((s) => ({ sid: s.conn.id, name: displayName(s.conn), tag: s.conn.tag, blocked: restoreBlockReason(s) }));

const sum = (results: CollectionResult[], field: "documents" | "duplicates") =>
  results.reduce((total, r) => total + r[field], 0);

const collectionsLabel = (n: number) => `${n} ${n === 1 ? "colección" : "colecciones"}`;

export const backupSummary = (db: string, results: CollectionResult[]) =>
  `Backup de ${db}: ${collectionsLabel(results.length)}, ${sum(results, "documents").toLocaleString()} documentos`;

export function restoreSummary(db: string, results: CollectionResult[]): string {
  const duplicates = sum(results, "duplicates");
  const skipped = duplicates ? ` (${duplicates.toLocaleString()} saltados por _id repetido)` : "";
  return `Restaurado en ${db}: ${collectionsLabel(results.length)}, ${sum(results, "documents").toLocaleString()} documentos${skipped}`;
}

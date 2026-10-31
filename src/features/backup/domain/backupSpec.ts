// Backup and restore of a database in the mongodump format (one folder per database).
import { collectionsLabel, totalDocuments, totalDuplicates, type CollectionResult } from "../../../shared/domain/jobs";
import { displayName, neverModified } from "../../connections/domain/connection";
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

export const FOLDER_REQUIRED = "Elige una carpeta";
export const COLLECTIONS_REQUIRED = "Elige al menos una colección";
export const TARGET_DB_REQUIRED = "Indica la base de datos de destino";
export const PROTECTED_TARGET = "Conexión protegida o de producción: no se restaura sobre ella";
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
  if (neverModified(session.conn)) return PROTECTED_TARGET;
  if (session.safeMode) return SAFE_MODE_TARGET;
  return undefined;
}

/** Sessions offered as restore destination, with the reason when they can't be one. */
export const restoreTargets = (sessions: Session[]) =>
  sessions.map((s) => ({ sid: s.conn.id, name: displayName(s.conn), tag: s.conn.tag, blocked: restoreBlockReason(s) }));

export const backupSummary = (db: string, results: CollectionResult[]) =>
  `Backup de ${db}: ${collectionsLabel(results.length)}, ${totalDocuments(results).toLocaleString()} documentos`;

export function restoreSummary(db: string, results: CollectionResult[]): string {
  const duplicates = totalDuplicates(results);
  const skipped = duplicates ? ` (${duplicates.toLocaleString()} saltados por _id repetido)` : "";
  return `Restaurado en ${db}: ${collectionsLabel(results.length)}, ${totalDocuments(results).toLocaleString()} documentos${skipped}`;
}

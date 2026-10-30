// Copying a collection to another database, on the same server or on another open connection.
import { creatableSpec } from "./indexSpec";
import type { Doc, IndexSpec } from "./mongo";

export interface CollectionRef {
  sid: string;
  db: string;
  coll: string;
}

export interface CopyRequest {
  source: CollectionRef;
  target: CollectionRef;
  copyIndexes: boolean;
}

export interface CopyProgress {
  copied: number;
  /** Estimated: the server's count when the copy started. */
  total: number;
}

export const ID_INDEX = "_id_";

export const TARGET_DB_REQUIRED = "Indica la base de datos de destino";
export const TARGET_COLL_REQUIRED = "Indica el nombre de la colección de destino";
export const TARGET_IS_SOURCE = "El destino es la misma colección que el origen";
export const INVALID_DB_NAME = "El nombre de la base de datos no puede contener / \\ . \" $ ni espacios";
export const INVALID_COLL_NAME = "El nombre de la colección no puede contener $ ni empezar por “system.”";

// Characters MongoDB rejects in database names (on any platform) and in collection names.
const DB_NAME_FORBIDDEN = /[/\\. "$*<>:|?]/;
const COLL_NAME_FORBIDDEN = /\$/;
const SYSTEM_PREFIX = "system.";

export const isSameServer = (r: CopyRequest) => r.source.sid === r.target.sid;

/** Checks the destination and trims its names. Throws the message to show. */
export function validateCopy(r: CopyRequest): CopyRequest {
  const target = { ...r.target, db: r.target.db.trim(), coll: r.target.coll.trim() };
  if (!target.db) throw TARGET_DB_REQUIRED;
  if (!target.coll) throw TARGET_COLL_REQUIRED;
  if (DB_NAME_FORBIDDEN.test(target.db)) throw INVALID_DB_NAME;
  if (COLL_NAME_FORBIDDEN.test(target.coll) || target.coll.startsWith(SYSTEM_PREFIX)) throw INVALID_COLL_NAME;
  const { source } = r;
  if (source.sid === target.sid && source.db === target.db && source.coll === target.coll) throw TARGET_IS_SOURCE;
  return { ...r, target };
}

/** Same-server copy: the server writes every document into the target, replacing it. */
export const copyPipeline = (target: CollectionRef): Doc[] => [
  { $match: {} },
  { $out: { db: target.db, coll: target.coll } },
];

/** Indexes to recreate on the target: all but `_id_` (it always exists), without server-managed fields. */
export const indexesToCopy = (indexes: IndexSpec[]): IndexSpec[] =>
  indexes.filter((ix) => ix.name !== ID_INDEX).map(creatableSpec);

/** Whole percentage for a progress bar; an empty source counts as done. */
export function progressPercent({ copied, total }: CopyProgress): number {
  if (total <= 0) return 100;
  return Math.min(100, Math.floor((copied / total) * 100));
}

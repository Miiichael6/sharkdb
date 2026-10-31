// Copying a collection to another database of the same server.
import { creatableSpec } from "./indexSpec";
import type { Doc, IndexSpec } from "./mongo";

export interface CollectionRef {
  sid: string;
  db: string;
  coll: string;
}

/** The target lives on the source's connection, so only its database and name are given. */
export interface CopyRequest {
  source: CollectionRef;
  target: { db: string; coll: string };
  copyIndexes: boolean;
}

export const ID_INDEX = "_id_";

export const TARGET_DB_REQUIRED = "Indica la base de datos de destino";
export const TARGET_COLL_REQUIRED = "Indica el nombre de la colección de destino";
export const TARGET_IS_SOURCE = "El destino es la misma colección que el origen";
export const TARGET_EXISTS = "Ya existe una colección con ese nombre";
export const INVALID_DB_NAME = "El nombre de la base de datos no puede contener / \\ . \" $ ni espacios";
export const INVALID_COLL_NAME = "El nombre de la colección no puede contener $ ni empezar por “system.”";

// Characters MongoDB rejects in database names (on any platform) and in collection names.
const DB_NAME_FORBIDDEN = /[/\\. "$*<>:|?]/;
const COLL_NAME_FORBIDDEN = /\$/;
const SYSTEM_PREFIX = "system.";

/** Whether MongoDB accepts `db` as a database name (on every platform). */
export const isValidDbName = (db: string) => !DB_NAME_FORBIDDEN.test(db);

/** Checks the destination and trims its names. Throws the message to show. */
export function validateCopy(r: CopyRequest): CopyRequest {
  const target = { db: r.target.db.trim(), coll: r.target.coll.trim() };
  if (!target.db) throw TARGET_DB_REQUIRED;
  if (!target.coll) throw TARGET_COLL_REQUIRED;
  if (!isValidDbName(target.db)) throw INVALID_DB_NAME;
  if (COLL_NAME_FORBIDDEN.test(target.coll) || target.coll.startsWith(SYSTEM_PREFIX)) throw INVALID_COLL_NAME;
  if (r.source.db === target.db && r.source.coll === target.coll) throw TARGET_IS_SOURCE;
  return { ...r, target };
}

/** Name a duplicate of `coll` is offered with, as in Robo 3T. */
export const duplicateName = (coll: string) => `${coll}_copy`;

/** Duplicating = copying into the same database, with its indexes. */
export const duplicateRequest = (source: CollectionRef, name: string): CopyRequest => ({
  source,
  target: { db: source.db, coll: name },
  copyIndexes: true,
});

/**
 * The server writes every document into the target, replacing it. `$out` to another database needs
 * MongoDB ≥ 4.4; within the same database the plain name works on every version.
 */
export const copyPipeline = (r: CopyRequest): Doc[] => [
  { $match: {} },
  { $out: r.target.db === r.source.db ? r.target.coll : { db: r.target.db, coll: r.target.coll } },
];

/** Indexes to recreate on the target: all but `_id_` (it always exists), without server-managed fields. */
export const indexesToCopy = (indexes: IndexSpec[]): IndexSpec[] =>
  indexes.filter((ix) => ix.name !== ID_INDEX).map(creatableSpec);

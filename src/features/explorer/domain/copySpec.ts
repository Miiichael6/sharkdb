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
export const TIMESERIES_TARGET_EXISTS =
  "Una colección time series no se puede copiar sobre otra que ya existe (MongoDB no permite renombrarla): elige otro nombre";
export const COPY_NOT_CONFIRMED = "No se copió: la colección de destino sigue como estaba";
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

/**
 * Provisional collection an existing target is copied into before taking its place. Short and not
 * derived from the target's name, so it never goes over the namespace length limit.
 */
export const copyStagingName = (run: string) => `sharkdb-copy-${run}`;

/**
 * Id of a copy's run, like an ObjectId: 24 hex digits starting with the seconds since the epoch, so
 * the backend can tell a provisional collection left by an interrupted copy from a running one by its age.
 */
export function copyRunId(now = Date.now()): string {
  const seconds = Math.floor(now / 1000).toString(16).padStart(8, "0");
  return seconds + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
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
 * How a new target gets the source's options (validator, collation, clustered index…), from its
 * `listCollections` options. `$out` keeps the options of a collection it replaces, so the target is
 * created with them first; except what `$out` can't write into or create that way:
 * - capped: `$out` refuses a capped target, so it is capped afterwards (`convertToCapped`, which
 *   keeps the other options but drops the indexes, plus `collMod` for `max`).
 * - time series: `$out` creates it itself (MongoDB ≥ 7.0.3); its expiry is set afterwards.
 * A view (`viewOn`, `pipeline`) is copied as a plain collection with its documents.
 */
export interface CopyOptions {
  /** `create` options; absent when `$out` creates the target (time series). */
  create?: Doc;
  capped?: { size: number; max?: number };
  timeseries?: Doc;
  expireAfterSeconds?: number;
}

const NOT_CREATABLE = new Set(["capped", "size", "max", "viewOn", "pipeline", "timeseries"]);

export function copyOptions(options: Doc): CopyOptions {
  if (options.timeseries) {
    const expiry = options.expireAfterSeconds;
    return { timeseries: options.timeseries as Doc, ...(expiry != null && { expireAfterSeconds: Number(expiry) }) };
  }
  const create = Object.fromEntries(Object.entries(options).filter(([k]) => !NOT_CREATABLE.has(k)));
  if (!options.capped) return { create };
  const max = Number(options.max ?? 0);
  return { create, capped: { size: Number(options.size), ...(max > 0 && { max }) } };
}

/** Whether the indexes can only be created once the documents are in (see `copyOptions`). */
export const indexesAfterDocuments = (o: CopyOptions) => !o.create || !!o.capped;

/**
 * The server writes every document into the target, replacing it. `$out` to another database needs
 * MongoDB ≥ 4.4; within the same database the plain name works on every version (but a time series
 * target always needs the full form).
 */
export const copyPipeline = (r: CopyRequest, timeseries?: Doc): Doc[] => [
  { $match: {} },
  {
    $out:
      r.target.db === r.source.db && !timeseries
        ? r.target.coll
        : { db: r.target.db, coll: r.target.coll, ...(timeseries && { timeseries }) },
  },
];

/** The documents already passed the source's validation; the target's must not reject them. */
export const COPY_PIPELINE_OPTIONS: Doc = { bypassDocumentValidation: true };

/** Indexes to recreate on the target: all but `_id_` (it always exists), without server-managed fields. */
export const indexesToCopy = (indexes: IndexSpec[]): IndexSpec[] =>
  indexes.filter((ix) => ix.name !== ID_INDEX).map(creatableSpec);

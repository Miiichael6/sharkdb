// Sync of loose documents (R97–R100, D25, D26): the documents picked in the viewer, read whole from
// the source by `_id`, replace (or are inserted as) the ones with their `_id` in the same database and
// collection of a connection of a lower environment.
import { CONFIRM_WORD } from "../../../shared/domain/confirmation";
import type { DocumentTarget } from "../../../shared/domain/documentTarget";
import type { CollectionResult } from "../../../shared/domain/jobs";
import type { DatabaseSelection } from "../../../shared/domain/selection";
import { displayName, type MongoConnection } from "../../connections/domain/connection";
import { connectionEndpoint, targetOptions } from "../../connections/domain/endpoints";
import { canSyncDocumentsTo, environmentLevelName } from "../../connections/domain/environmentLevel";
import type { Session } from "../../connections/domain/session";
import { TARGET_IS_SOURCE, TARGET_REQUIRED } from "./syncPlan";

/** A document as canonical Extended JSON. */
export type FullDocument = Record<string, unknown>;

export interface DocumentSyncRequest {
  sourceSid: string;
  targetSid: string;
  db: string;
  collection: string;
  /** `_id` of each document, as canonical Extended JSON. */
  ids: unknown[];
}

const ID_FIELD = "_id";

export const DOCUMENTS_REQUIRED = "Elige al menos un documento con _id";
export const TARGET_NOT_LOWER = "Solo se sincronizan documentos hacia un entorno de menor nivel: prod → QA, development o local; QA → development o local; development → local";
export const NO_COLLECTION = "La consulta no deja saber de qué colección vienen los documentos";
export const NO_ID = "Algún documento elegido no tiene _id";

/** The `_id` of each document, or null when one of them has none (a projection without it, an aggregate). */
export function documentIds(docs: unknown[]): unknown[] | null {
  const ids = docs.map((doc) => (doc && typeof doc === "object" ? (doc as FullDocument)[ID_FIELD] : undefined));
  return ids.length && ids.every((id) => id !== undefined) ? ids : null;
}

/** Why the picked `docs` of a result can't be synced, or undefined when they can (the menu entry shows it). */
export function documentSyncUnavailable(target: DocumentTarget | null, docs: unknown[]): string | undefined {
  if (!target) return NO_COLLECTION;
  if (!documentIds(docs)) return NO_ID;
  return undefined;
}

export const documentSyncRequest = (target: DocumentTarget, targetSid: string, ids: unknown[]): DocumentSyncRequest => ({
  sourceSid: target.sid,
  targetSid,
  db: target.db,
  collection: target.coll,
  ids,
});

/** Checks a document sync against the registered `connections`. Throws the message to show. */
export function validateDocumentSync(r: DocumentSyncRequest, connections: MongoConnection[]): DocumentSyncRequest {
  if (!r.targetSid) throw TARGET_REQUIRED;
  if (r.sourceSid === r.targetSid) throw TARGET_IS_SOURCE;
  if (!r.ids.length) throw DOCUMENTS_REQUIRED;
  const source = connections.find((c) => c.id === r.sourceSid);
  const target = connections.find((c) => c.id === r.targetSid);
  if (!source || !target || !canSyncDocumentsTo(source, target, connections)) throw TARGET_NOT_LOWER;
  return r;
}

/**
 * Why documents of `source` have nowhere to go: its environment is the lowest, or no registered
 * connection is below it. Names the tag, since it may not match the connection's name (e.g. "QA" tagged development).
 */
export function noDocumentTarget(source: MongoConnection): string {
  const level = environmentLevelName(source.tag);
  return source.tag === "local"
    ? `${displayName(source)} tiene el entorno "local", el más bajo: no hay a dónde sincronizar. Si es de otro entorno, cámbialo al editar la conexión.`
    : `No hay ninguna conexión registrada de menor nivel que ${displayName(source)} (${level}) en la que se pueda escribir.`;
}

/** Destinations offered for documents of `sourceSid`: only connections of a lower level that can be written to. */
export function documentSyncTargets(connections: MongoConnection[], sessions: Session[], sourceSid: string) {
  const source = connections.find((c) => c.id === sourceSid);
  if (!source) return [];
  const lower = new Set(connections.filter((c) => canSyncDocumentsTo(source, c, connections)).map((c) => c.id));
  return targetOptions(connections, sessions, sourceSid).filter((option) => lower.has(option.id));
}

/** One end of the sync as the confirmation shows it: connection with its environment, database and collection. */
export interface DocumentSyncEnd {
  name: string;
  tag?: string;
  address?: string;
  db: string;
  collection: string;
}

/** The confirmation window (R99, D26): both ends and every document whole, before typing `confirmo`. */
export interface DocumentSyncConfirmation {
  title: string;
  source: DocumentSyncEnd;
  target: DocumentSyncEnd;
  documents: FullDocument[];
  /** Ids picked that the source no longer has. */
  missing: number;
  confirmWord: string;
  confirmLabel: string;
  /** Why it can't go ahead now (e.g. another operation writes there); the button stays disabled. */
  blocked?: string;
}

const endOf = (connections: MongoConnection[], sid: string, r: DocumentSyncRequest): DocumentSyncEnd => ({
  ...connectionEndpoint(connections, sid),
  db: r.db,
  collection: r.collection,
});

export const documentSyncConfirmation = (
  r: DocumentSyncRequest,
  connections: MongoConnection[],
  documents: FullDocument[],
  blocked?: string,
): DocumentSyncConfirmation => ({
  title: "Confirmar sincronización de documentos",
  source: endOf(connections, r.sourceSid, r),
  target: endOf(connections, r.targetSid, r),
  documents,
  missing: Math.max(r.ids.length - documents.length, 0),
  confirmWord: CONFIRM_WORD,
  confirmLabel: "Sincronizar",
  blocked,
});

/** The first window's button: it still asks for `confirmo` in the next one. */
export const syncDocumentsLabel = (n: number) => (n === 1 ? "Sincronizar documento" : `Sincronizar ${n.toLocaleString()} documentos`);

export const documentsLabel = (n: number) => `${n.toLocaleString()} ${n === 1 ? "documento" : "documentos"}`;

/** The collection it writes to, as the operations panel lists it. */
export const documentSyncSelection = (r: DocumentSyncRequest): DatabaseSelection[] => [{ db: r.db, collections: [r.collection] }];

export const documentSyncSummary = (target: string, r: DocumentSyncRequest, results: CollectionResult[]) =>
  `Sincronizados en ${target} · ${r.db}.${r.collection}: ${documentsLabel(results.reduce((n, x) => n + x.documents, 0))}`;

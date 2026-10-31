// Sync between environments (R30, D7): replaces whole databases or some of their collections in
// another connection, each database in the one with its same name.
import type { DangerConfirmRequest } from "../../../shared/domain/confirmation";
import { collectionsLabel, totalDocuments, type CollectionResult } from "../../../shared/domain/jobs";
import { COLLECTIONS_REQUIRED, restoreBlockReason } from "../../backup/domain/backupSpec";
import { displayName, neverModified, type MongoConnection, type Tag } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";

/** A database of the source, as the backend lists it: system databases and collections never appear. */
export interface DatabaseCatalog {
  name: string;
  sizeOnDisk: number;
  collections: string[];
}

/** Chosen collections of each database, by database name. */
export type Selection = Record<string, string[]>;

export interface SyncRequest {
  sourceSid: string;
  targetSid: string;
  databases: { db: string; collections: string[] }[];
}

/** What happens to one database of the destination. */
export interface PlanDatabase {
  db: string;
  collections: string[];
  /** Every collection of the source database is copied. */
  complete: boolean;
  /** The destination already has it (its chosen collections are replaced) or it's created. */
  action: "replace" | "create";
}

/** A registered connection offered as one end of the sync; a closed one is connected when chosen. */
export interface SyncConnection {
  id: string;
  name: string;
  tag: Tag;
  connected: boolean;
  /** Why it can't be the destination now (safe mode on), shown next to it. */
  blocked?: string;
}

export const TARGET_REQUIRED = "Elige la conexión de destino";
export const NO_TARGET = "No hay otra conexión que se pueda modificar";
export const TARGET_IS_SOURCE = "El destino no puede ser la conexión de origen";

/** How much of a database is chosen, for its checkbox. */
export type DatabaseState = "none" | "partial" | "complete";

export function databaseState(selection: Selection, database: DatabaseCatalog): DatabaseState {
  const chosen = selection[database.name]?.length ?? 0;
  if (!chosen) return "none";
  return chosen === database.collections.length ? "complete" : "partial";
}

/** Checking a database chooses all of it; unchecking (or a complete one) clears it. */
export function toggleDatabase(selection: Selection, database: DatabaseCatalog): Selection {
  const { [database.name]: _, ...rest } = selection;
  return databaseState(selection, database) === "complete" ? rest : { ...rest, [database.name]: [...database.collections] };
}

/** Adds or removes one collection, keeping the source's order; an empty database leaves the selection. */
export function toggleCollection(selection: Selection, database: DatabaseCatalog, collection: string): Selection {
  const chosen = new Set(selection[database.name]);
  if (chosen.has(collection)) chosen.delete(collection);
  else chosen.add(collection);
  const { [database.name]: _, ...rest } = selection;
  const next = database.collections.filter((c) => chosen.has(c));
  return next.length ? { ...rest, [database.name]: next } : rest;
}

/** "Todas completas": every database of the source, whole. */
export const selectEverything = (catalog: DatabaseCatalog[]): Selection =>
  Object.fromEntries(catalog.filter((d) => d.collections.length).map((d) => [d.name, [...d.collections]]));

/** What was chosen where the window was opened: the collection, or the whole database. */
export function originSelection(catalog: DatabaseCatalog[], db?: string, collection?: string): Selection {
  const database = catalog.find((d) => d.name === db);
  if (!database) return {};
  if (collection) return database.collections.includes(collection) ? { [database.name]: [collection] } : {};
  return toggleDatabase({}, database);
}

/** Collections whose name contains `query`, ignoring case. */
export const filterCollections = (collections: string[], query: string) => {
  const q = query.trim().toLowerCase();
  return q ? collections.filter((c) => c.toLowerCase().includes(q)) : collections;
};

/** What the sync will do in the destination, in the source's order. */
export const syncPlan = (catalog: DatabaseCatalog[], selection: Selection, targetDatabases: string[]): PlanDatabase[] =>
  catalog
    .filter((d) => selection[d.name]?.length)
    .map((d) => ({
      db: d.name,
      collections: selection[d.name],
      complete: databaseState(selection, d) === "complete",
      action: targetDatabases.includes(d.name) ? "replace" : "create",
    }));

export const planCollections = (plan: PlanDatabase[]) => plan.reduce((sum, d) => sum + d.collections.length, 0);

export const syncRequest = (sourceSid: string, targetSid: string, plan: PlanDatabase[]): SyncRequest => ({
  sourceSid,
  targetSid,
  databases: plan.map(({ db, collections }) => ({ db, collections })),
});

/** Checks a sync. Throws the message to show. */
export function validateSync(r: SyncRequest): SyncRequest {
  if (!r.targetSid) throw TARGET_REQUIRED;
  if (r.sourceSid === r.targetSid) throw TARGET_IS_SOURCE;
  if (!r.databases.some((d) => d.collections.length)) throw COLLECTIONS_REQUIRED;
  return r;
}

function syncConnections(connections: MongoConnection[], sessions: Session[], exceptId: string): SyncConnection[] {
  return connections
    .filter((conn) => conn.id !== exceptId)
    .map((conn) => {
      const session = sessions.find((s) => s.conn.id === conn.id);
      return {
        id: conn.id,
        name: displayName(conn),
        tag: conn.tag,
        connected: !!session,
        blocked: session && restoreBlockReason(session),
      };
    });
}

/**
 * Connections offered as source: every registered one, since it's only read, except the chosen
 * destination, so both ends are never the same connection.
 */
export const syncSources = (connections: MongoConnection[], sessions: Session[], targetId = "") =>
  syncConnections(connections, sessions, targetId).map(({ blocked: _, ...source }) => source);

/**
 * Connections offered as destination: every registered one but the source; protected or production
 * ones never appear (D7), open or closed, so nothing is ever copied into production.
 */
export const syncTargets = (connections: MongoConnection[], sessions: Session[], sourceId = "") =>
  syncConnections(
    connections.filter((conn) => !neverModified(conn)),
    sessions,
    sourceId,
  );

/** The chosen destination while it's still offered and usable; otherwise another one, or "" when none is. */
export const pickTarget = (targets: SyncConnection[], currentId: string) =>
  (targets.find((t) => t.id === currentId && !t.blocked) ?? targets.find((t) => !t.blocked))?.id ?? "";

/** The chosen collections of a request, to choose them again when going back to the selection. */
export const requestSelection = (request: SyncRequest): Selection =>
  Object.fromEntries(request.databases.filter((d) => d.collections.length).map((d) => [d.db, d.collections]));

const databasesLabel = (n: number) => `${n} ${n === 1 ? "base de datos" : "bases de datos"}`;

const ACTION_LABELS: Record<PlanDatabase["action"], string> = { replace: "reemplaza", create: "nueva" };
/** Collections listed by name for a partial database; beyond this, only the count. */
const LISTED_COLLECTIONS = 4;

/** "completa · 12 colecciones", or the chosen collections of a partial database. */
export function databaseDetail(d: PlanDatabase): string {
  if (d.complete) return `completa · ${collectionsLabel(d.collections.length)}`;
  const names = d.collections.slice(0, LISTED_COLLECTIONS).join(", ");
  const more = d.collections.length - LISTED_COLLECTIONS;
  return more > 0 ? `${names} y ${more} más` : names;
}

export const actionLabel = (d: PlanDatabase) => ACTION_LABELS[d.action];

/** The second window: what the destination loses, before typing the confirmation word (D9). */
export const syncConfirmation = (
  plan: PlanDatabase[],
  source: string,
  target: { name: string; tag?: string },
  blocked?: string,
): DangerConfirmRequest => ({
  title: "Confirmar sincronización",
  target,
  intro: `con el contenido de ${source}; cada base de datos va a la de su mismo nombre.`,
  items: plan.map((d) => ({ badge: actionLabel(d), kind: d.action, name: d.db, detail: databaseDetail(d) })),
  note: "Las colecciones del destino que no elegiste se conservan sin tocar.",
  confirmLabel: "Sincronizar",
  blocked,
});

/** "2 bases de datos · 35 colecciones", for the footer. */
export const planLabel = (plan: PlanDatabase[]) => `${databasesLabel(plan.length)} · ${collectionsLabel(planCollections(plan))}`;

export const syncSummary = (target: string, databases: number, results: CollectionResult[]) =>
  `Sincronizado ${target}: ${databasesLabel(databases)}, ${collectionsLabel(results.length)}, ${totalDocuments(results).toLocaleString()} documentos`;

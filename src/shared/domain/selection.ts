// What sync, backup and restore choose: whole databases or some of their collections, across several databases.
import { favoritesFirst } from "./favoritesFirst";

/** A database offered to choose from (of a server or a backup folder): system databases and collections never appear. */
export interface DatabaseCatalog {
  name: string;
  sizeOnDisk: number;
  collections: string[];
}

/** Chosen collections of each database, by database name. */
export type Selection = Record<string, string[]>;

/** Chosen collections of one database, as the backend receives them. */
export interface DatabaseSelection {
  db: string;
  collections: string[];
}

/** Where a window was opened from (a connection, database or collection of the tree), to preselect it. */
export interface SelectionOrigin {
  sid: string;
  db?: string;
  collection?: string;
}

export const COLLECTIONS_REQUIRED = "Elige al menos una colección";

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

/** Adds or removes one collection, keeping the catalog's order; an empty database leaves the selection. */
export function toggleCollection(selection: Selection, database: DatabaseCatalog, collection: string): Selection {
  const chosen = new Set(selection[database.name]);
  if (chosen.has(collection)) chosen.delete(collection);
  else chosen.add(collection);
  const { [database.name]: _, ...rest } = selection;
  const next = database.collections.filter((c) => chosen.has(c));
  return next.length ? { ...rest, [database.name]: next } : rest;
}

/** "Todas completas": every database of the catalog, whole. */
export const selectEverything = (catalog: DatabaseCatalog[]): Selection =>
  Object.fromEntries(catalog.filter((d) => d.collections.length).map((d) => [d.name, [...d.collections]]));

/** What was chosen where the window was opened: the collection, or the whole database. */
export function originSelection(catalog: DatabaseCatalog[], db?: string, collection?: string): Selection {
  const database = catalog.find((d) => d.name === db);
  if (!database) return {};
  if (collection) return database.collections.includes(collection) ? { [database.name]: [collection] } : {};
  return toggleDatabase({}, database);
}

/** The catalog with the `favorites` first and the rest below, none hidden (R46). */
export function catalogFavoritesFirst(catalog: DatabaseCatalog[], favorites: string[]): DatabaseCatalog[] {
  const compare = favoritesFirst(favorites);
  return [...catalog].sort((a, b) => compare(a.name, b.name));
}

/** Collections whose name contains `query`, ignoring case. */
export const filterCollections = (collections: string[], query: string) => {
  const q = query.trim().toLowerCase();
  return q ? collections.filter((c) => c.toLowerCase().includes(q)) : collections;
};

/** The chosen collections of a request, to choose them again when going back to the selection. */
export const selectionOf = (databases: DatabaseSelection[]): Selection =>
  Object.fromEntries(databases.filter((d) => d.collections.length).map((d) => [d.db, d.collections]));

/** Databases that start expanded: those chosen before "Volver", or the one of the origin collection. */
export function initiallyExpanded(initial: DatabaseSelection[] | undefined, origin: Partial<SelectionOrigin>): string[] {
  if (initial) return initial.map((d) => d.db);
  return origin.collection && origin.db ? [origin.db] : [];
}

/** Throws `COLLECTIONS_REQUIRED` when no collection is chosen. */
export function requireCollections(databases: DatabaseSelection[]) {
  if (!databases.some((d) => d.collections.length)) throw COLLECTIONS_REQUIRED;
}

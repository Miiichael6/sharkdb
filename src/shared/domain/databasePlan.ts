// What sync, backup and restore do to each chosen database, for the summary and the confirmation window.
import type { DangerItem } from "./confirmation";
import { collectionsLabel } from "./jobs";
import { databaseState, type DatabaseCatalog, type DatabaseSelection, type Selection } from "./selection";

/** The destination already has the database (its chosen collections are replaced), it's created, or it's saved to a folder. */
export type PlanAction = "replace" | "create" | "save";

/** What happens to one chosen database. */
export interface PlanDatabase {
  db: string;
  collections: string[];
  /** Every collection of the database is chosen. */
  complete: boolean;
  action: PlanAction;
}

const ACTION_LABELS: Record<PlanAction, string> = { replace: "reemplaza", create: "nueva", save: "guarda" };
/** Collections listed by name for a partial database; beyond this, only the count. */
const LISTED_COLLECTIONS = 4;

/** The chosen databases, in the catalog's order, each with what happens to it. */
export const databasePlan = (catalog: DatabaseCatalog[], selection: Selection, actionOf: (db: string) => PlanAction): PlanDatabase[] =>
  catalog
    .filter((d) => selection[d.name]?.length)
    .map((d) => ({
      db: d.name,
      collections: selection[d.name],
      complete: databaseState(selection, d) === "complete",
      action: actionOf(d.name),
    }));

/** Plan into a connection: each database goes to the one with its same name, replaced when it exists. */
export const replacePlan = (catalog: DatabaseCatalog[], selection: Selection, targetDatabases: string[]) =>
  databasePlan(catalog, selection, (db) => (targetDatabases.includes(db) ? "replace" : "create"));

export const planSelections = (plan: PlanDatabase[]): DatabaseSelection[] => plan.map(({ db, collections }) => ({ db, collections }));

export const planCollections = (plan: PlanDatabase[]) => plan.reduce((sum, d) => sum + d.collections.length, 0);

export const databasesLabel = (n: number) => `${n} ${n === 1 ? "base de datos" : "bases de datos"}`;

/** "2 bases de datos · 35 colecciones", for the footer. */
export const planLabel = (plan: PlanDatabase[]) => `${databasesLabel(plan.length)} · ${collectionsLabel(planCollections(plan))}`;

export const actionLabel = (d: PlanDatabase) => ACTION_LABELS[d.action];

/** "completa · 12 colecciones", or the chosen collections of a partial database. */
export function databaseDetail(d: PlanDatabase): string {
  if (d.complete) return `completa · ${collectionsLabel(d.collections.length)}`;
  const names = d.collections.slice(0, LISTED_COLLECTIONS).join(", ");
  const more = d.collections.length - LISTED_COLLECTIONS;
  return more > 0 ? `${names} y ${more} más` : names;
}

/** The plan as lines of the confirmation window. */
export const planItems = (plan: PlanDatabase[]): DangerItem[] =>
  plan.map((d) => ({ badge: actionLabel(d), kind: d.action, name: d.db, detail: databaseDetail(d) }));

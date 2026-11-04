// Backup and restore of several databases in the `mongodump --out` format: one folder per database.
import type { DangerConfirmRequest } from "../../../shared/domain/confirmation";
import { databasePlan, databasesLabel, planItems, replacePlan, type PlanDatabase } from "../../../shared/domain/databasePlan";
import { collectionsLabel, totalDocuments, type CollectionResult } from "../../../shared/domain/jobs";
import { folderName } from "../../../shared/domain/operations";
import { requireCollections, selectionOf, type DatabaseCatalog, type DatabaseSelection, type Selection } from "../../../shared/domain/selection";

/**
 * A database of a backup. `complete` when it was chosen whole: a schedule then saves the collections
 * it has at each run, not the ones it had when chosen (error 47). The backend ignores it.
 */
export interface BackupDatabase extends DatabaseSelection {
  complete?: boolean;
}

export interface BackupRequest {
  sid: string;
  /** Output folder: each database goes to `<dir>/<db>`. */
  dir: string;
  databases: BackupDatabase[];
}

export interface RestoreRequest {
  /** Backup folder: databases in subfolders, or a single one (task 14) with its `.bson` at the root. */
  dir: string;
  targetSid: string;
  /** Each one goes to the database with its same name in the destination. */
  databases: DatabaseSelection[];
}

export const FOLDER_REQUIRED = "Elige una carpeta";
export const SOURCE_REQUIRED = "Elige la conexión de origen";
export const TARGET_REQUIRED = "Elige la conexión de destino";

function requireFolder(dir: string): string {
  const trimmed = dir.trim();
  if (!trimmed) throw FOLDER_REQUIRED;
  return trimmed;
}

/** Checks a backup and trims its folder. Throws the message to show. */
export function validateBackup(r: BackupRequest): BackupRequest {
  if (!r.sid) throw SOURCE_REQUIRED;
  const dir = requireFolder(r.dir);
  requireCollections(r.databases);
  return { ...r, dir };
}

/** Checks a restore and trims its folder. Throws the message to show. */
export function validateRestore(r: RestoreRequest): RestoreRequest {
  const dir = requireFolder(r.dir);
  if (!r.targetSid) throw TARGET_REQUIRED;
  requireCollections(r.databases);
  return { ...r, dir };
}

/** The plan as a backup's databases: those chosen whole say so. */
export const backupDatabases = (plan: PlanDatabase[]): BackupDatabase[] =>
  plan.map(({ db, collections, complete }) => (complete ? { db, collections, complete } : { db, collections }));

/** What a backup saves of each database now: the whole ones as they are, the rest without what no longer exists. */
export interface CurrentDatabases {
  databases: BackupDatabase[];
  /** "db" or "db.collection": chosen, but gone from the server. */
  missing: string[];
}

export function currentDatabases(databases: BackupDatabase[], catalog: DatabaseCatalog[]): CurrentDatabases {
  const missing: string[] = [];
  const current = databases.flatMap((d): BackupDatabase[] => {
    const found = catalog.find((c) => c.name === d.db);
    if (!found?.collections.length) {
      missing.push(d.db);
      return [];
    }
    if (d.complete) return [{ ...d, collections: [...found.collections] }];
    const kept = d.collections.filter((c) => found.collections.includes(c));
    missing.push(...d.collections.filter((c) => !kept.includes(c)).map((c) => `${d.db}.${c}`));
    return kept.length ? [{ ...d, collections: kept }] : [];
  });
  return { databases: current, missing };
}

/** Choosing again what a backup saves: the whole databases with every collection they have now (error 47). */
export const currentSelection = (databases: BackupDatabase[], catalog: DatabaseCatalog[]): Selection =>
  selectionOf(currentDatabases(databases, catalog).databases);

/** What a run skipped: "shop.orders, logs". */
export const missingNote = (missing: string[]) => `Ya no existen y no se guardaron: ${missing.join(", ")}`;

/** Every chosen database is saved to the folder. */
export const backupPlan = (catalog: DatabaseCatalog[], selection: Selection) => databasePlan(catalog, selection, () => "save");

/** Each chosen database of the folder replaces (or creates) the one with its same name in the destination. */
export const restorePlan = replacePlan;

/** "Se va a GUARDAR en {carpeta}": a backup only reads its connection, but may overwrite files of the folder. */
export const backupConfirmation = (plan: PlanDatabase[], source: string, dir: string, blocked?: string): DangerConfirmRequest => ({
  title: "Confirmar backup",
  heading: "Se va a GUARDAR en",
  target: { name: dir },
  intro: `el contenido de ${source}; cada base de datos en su propia carpeta, como mongodump.`,
  items: planItems(plan),
  note: "Si la carpeta ya tiene alguna de estas bases de datos, sus archivos se sobrescriben.",
  confirmLabel: "Hacer backup",
  blocked,
});

/** "Se va a MODIFICAR {conexión}": what the destination loses, before typing the confirmation word. */
export const restoreConfirmation = (
  plan: PlanDatabase[],
  dir: string,
  target: { name: string; tag?: string },
  blocked?: string,
): DangerConfirmRequest => ({
  title: "Confirmar restore",
  target,
  intro: `con el contenido de ${dir}; cada base de datos va a la de su mismo nombre.`,
  items: planItems(plan),
  note: "Las colecciones del destino que no elegiste se conservan sin tocar.",
  confirmLabel: "Restaurar",
  blocked,
});

const totals = (databases: number, results: CollectionResult[]) =>
  `${databasesLabel(databases)}, ${collectionsLabel(results.length)}, ${totalDocuments(results).toLocaleString()} documentos`;

export const backupSummary = (dir: string, databases: number, results: CollectionResult[]) =>
  `Backup en ${folderName(dir)}: ${totals(databases, results)}`;

export const restoreSummary = (target: string, databases: number, results: CollectionResult[]) =>
  `Restaurado en ${target}: ${totals(databases, results)}`;

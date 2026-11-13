// State and progress of each collection of an operation (R94, R95, D23), grouped by database.
import type { CollectionResult } from "./jobs";
import type { OperationKind } from "./operations";
import type { DatabaseSelection } from "./selection";

/**
 * Where a collection stands. `copied`: written to its staging collection, the target is replaced
 * only when all of them are (sync, restore). `discarded`: the operation was cancelled or failed
 * before it was applied, so the target kept what it had.
 */
export type CollectionStatus = "pending" | "running" | "copied" | "applied" | "failed" | "discarded";

/** The states the backend reports; `pending` and `discarded` are deduced here. */
export type ReportedCollectionState = "running" | "copied" | "applied" | "failed";

/** Event `job-collection`: how one collection of job `job` goes. */
export interface CollectionUpdate {
  job: string;
  db: string;
  collection: string;
  state: ReportedCollectionState;
  done: number;
  total: number;
  error?: string;
}

export interface CollectionProgressEntry {
  db: string;
  collection: string;
  status: CollectionStatus;
  done: number;
  total: number;
  error?: string;
  /** It reached its staging collection: from then on it's in the replacement phase, even if discarded. */
  staged?: true;
}

export interface DatabaseGroup {
  db: string;
  collections: CollectionProgressEntry[];
}

export interface DatabaseSummary {
  applied: number;
  total: number;
  percent: number;
  /** The state its header shows: the one that matters most among its collections. */
  worst: CollectionStatus;
}

/** How a finished operation ended, as far as its collections care. */
export type OperationEnd = "done" | "failed" | "cancelled";

/** How far along each state is: an update never takes a collection back (a late event changes nothing). */
const STAGE: Record<CollectionStatus, number> = { pending: 0, running: 1, copied: 2, applied: 3, failed: 3, discarded: 3 };

/** The order in which a database header picks its state, most important first. */
const SEVERITY: CollectionStatus[] = ["failed", "discarded", "running", "copied", "pending", "applied"];

const FULL = 100;

const sameCollection = (entry: Pick<CollectionProgressEntry, "db" | "collection">, db: string, collection: string) =>
  entry.db === db && entry.collection === collection;

/** Every chosen collection, waiting, in the order the job goes through them. */
export const plannedCollections = (databases: DatabaseSelection[]): CollectionProgressEntry[] =>
  databases.flatMap(({ db, collections }) =>
    collections.map((collection) => ({ db, collection, status: "pending" as const, done: 0, total: 0 })),
  );

const entryFrom = (
  { db, collection, state, done, total, error }: CollectionUpdate,
  previous?: CollectionProgressEntry,
): CollectionProgressEntry => ({
  db,
  collection,
  status: state,
  done,
  total,
  ...(error === undefined ? {} : { error }),
  ...(previous?.staged || state === "copied" ? { staged: true as const } : {}),
});

/** `list` with `update` applied; one the plan didn't have is added at the end. */
export function applyCollectionEvent(list: CollectionProgressEntry[], update: CollectionUpdate): CollectionProgressEntry[] {
  const index = list.findIndex((entry) => sameCollection(entry, update.db, update.collection));
  if (index < 0) return [...list, entryFrom(update)];
  if (STAGE[update.state] < STAGE[list[index].status]) return list;
  return list.map((entry, i) => (i === index ? entryFrom(update, entry) : entry));
}

const completed = (entry: CollectionProgressEntry): CollectionProgressEntry => {
  const done = Math.max(entry.done, entry.total);
  return { ...entry, status: "applied", done, total: done };
};

/**
 * The collections once the operation ended. Done: every one was applied. Cancelled or failed: what
 * wasn't applied is discarded, the target kept it as it was (R95); the one that failed keeps its error.
 * A backup that didn't end well keeps nothing: its folder is marked incomplete and can't be restored.
 */
export function settleCollections(
  list: CollectionProgressEntry[],
  end: OperationEnd,
  kind?: OperationKind,
): CollectionProgressEntry[] {
  if (end === "done") return list.map((entry) => (entry.status === "applied" ? entry : completed(entry)));
  const stays = (entry: CollectionProgressEntry) =>
    entry.status === "failed" || (entry.status === "applied" && kind !== "backup");
  return list.map((entry) => (stays(entry) ? entry : { ...entry, status: "discarded" }));
}

/**
 * Applied but short of its total: a document sync cancelled halfway keeps what it wrote. Any other
 * applied collection is whole (the backend and `settleCollections` close its count).
 */
export const isPartiallyApplied = (entry: CollectionProgressEntry) =>
  entry.status === "applied" && entry.total > 0 && entry.done < entry.total;

/** "3 de 10": how far a partially applied collection got. */
export const partialProgressLabel = (entry: CollectionProgressEntry) =>
  `${entry.done.toLocaleString()} de ${entry.total.toLocaleString()}`;

/** 0–100 of one collection; a copied one is whole even though the target doesn't have it yet. */
export function collectionPercent(entry: CollectionProgressEntry): number {
  if (isPartiallyApplied(entry)) return Math.round((entry.done / entry.total) * FULL);
  if (entry.status === "copied" || entry.status === "applied") return FULL;
  if (entry.total <= 0) return 0;
  return Math.round(Math.min(entry.done / entry.total, 1) * FULL);
}

/**
 * The two phases of an operation that writes through staging collections (sync, restore): first each
 * collection is copied to its provisional one, then all of them replace their targets at the end.
 */
export type CollectionPhase = "copy" | "replace";

const STAGING_KINDS: OperationKind[] = ["sync", "restore"];

export const usesStaging = (kind: OperationKind) => STAGING_KINDS.includes(kind);

/** Copied (or applied) collections are in the replacement phase; the rest are still being copied. */
export const collectionPhase = (entry: CollectionProgressEntry): CollectionPhase =>
  entry.staged || entry.status === "applied" ? "replace" : "copy";

export const inPhase = (list: CollectionProgressEntry[], phase: CollectionPhase) =>
  list.filter((entry) => collectionPhase(entry) === phase);

/** The collections by database, in the order of the plan. */
export function byDatabase(list: CollectionProgressEntry[]): DatabaseGroup[] {
  const groups = new Map<string, CollectionProgressEntry[]>();
  for (const entry of list) {
    const collections = groups.get(entry.db);
    if (collections) collections.push(entry);
    else groups.set(entry.db, [entry]);
  }
  return [...groups].map(([db, collections]) => ({ db, collections }));
}

export function databaseSummary(group: DatabaseGroup): DatabaseSummary {
  const { collections } = group;
  const total = collections.length;
  const percents = collections.reduce((sum, entry) => sum + collectionPercent(entry), 0);
  const present = new Set(collections.map((entry) => entry.status));
  return {
    applied: collections.filter((entry) => entry.status === "applied").length,
    total,
    percent: total ? Math.round(percents / total) : 0,
    worst: SEVERITY.find((status) => present.has(status)) ?? "pending",
  };
}

/** Documents of `entry` that a restore skipped because their `_id` already existed (D23: "⚠ N duplicados"). */
export const collectionDuplicates = (entry: CollectionProgressEntry, results: CollectionResult[]): number =>
  results.find((result) => result.collection === `${entry.db}.${entry.collection}`)?.duplicates ?? 0;

/** What each state is called (D23); the CSS class of its dot is the state itself (`.ops-dot.<estado>`). */
const STATUS_LABELS: Record<CollectionStatus, string> = {
  pending: "Pendiente",
  running: "En curso",
  copied: "Copiada, se aplica al final",
  applied: "Aplicada",
  failed: "Error",
  discarded: "Descartada",
};

/** A backup writes files, it doesn't apply anything to a target: what it finished is "Guardada". */
const BACKUP_APPLIED = "Guardada";

/** Cancelled after writing some of its documents: those stay in the target, the rest weren't written. */
const PARTIALLY_APPLIED = "Aplicada en parte";

export const collectionStatusLabel = (status: CollectionStatus, kind: OperationKind, partial = false) =>
  status === "applied" && kind === "backup" ? BACKUP_APPLIED : status === "applied" && partial ? PARTIALLY_APPLIED : STATUS_LABELS[status];

/** "⚠ 3 duplicados": documents a restore skipped because their `_id` was already there. */
export const duplicatesLabel = (count: number) => `⚠ ${count} ${count === 1 ? "duplicado" : "duplicados"}`;

/**
 * The state of a collection in words, for its tooltip and screen readers (R96): it never depends
 * on the colour alone. "pedidos · En curso · 47 %", "pedidos · Error: <motivo>".
 */
export function collectionDescription(entry: CollectionProgressEntry, kind: OperationKind, duplicates = 0): string {
  const partial = isPartiallyApplied(entry);
  const label = collectionStatusLabel(entry.status, kind, partial);
  const state = entry.status === "failed" && entry.error ? `${label}: ${entry.error}` : label;
  const parts = [entry.collection, state, partial ? partialProgressLabel(entry) : `${collectionPercent(entry)} %`];
  if (duplicates > 0) parts.push(duplicatesLabel(duplicates));
  return parts.join(" · ");
}

/** "12/20 · 64 %": collections finished out of the total and the database's average. */
export const databaseSummaryLabel = ({ applied, total, percent }: DatabaseSummary) => `${applied}/${total} · ${percent} %`;

/** "3 · 40 %": while copying nothing is finished yet, only how many there are and how far they got. */
export const copySummaryLabel = ({ total, percent }: DatabaseSummary) => `${total} · ${percent} %`;

/** States that keep a database open: it's being worked on, or something in it went wrong. */
const OPEN_STATES: CollectionStatus[] = ["running", "copied", "failed"];

/** Whether a database section starts open: the only one, or one in course or with an error (R91). */
export const opensByDefault = (summary: DatabaseSummary, databaseCount: number) =>
  databaseCount === 1 || OPEN_STATES.includes(summary.worst);

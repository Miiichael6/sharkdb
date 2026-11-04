// State and progress of each collection of an operation (R94, R95, D23), grouped by database.
import type { CollectionResult } from "./jobs";
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

const entryFrom = ({ db, collection, state, done, total, error }: CollectionUpdate): CollectionProgressEntry => ({
  db,
  collection,
  status: state,
  done,
  total,
  ...(error === undefined ? {} : { error }),
});

/** `list` with `update` applied; one the plan didn't have is added at the end. */
export function applyCollectionEvent(list: CollectionProgressEntry[], update: CollectionUpdate): CollectionProgressEntry[] {
  const index = list.findIndex((entry) => sameCollection(entry, update.db, update.collection));
  if (index < 0) return [...list, entryFrom(update)];
  if (STAGE[update.state] < STAGE[list[index].status]) return list;
  return list.map((entry, i) => (i === index ? entryFrom(update) : entry));
}

const completed = (entry: CollectionProgressEntry): CollectionProgressEntry => {
  const done = Math.max(entry.done, entry.total);
  return { ...entry, status: "applied", done, total: done };
};

/**
 * The collections once the operation ended. Done: every one was applied. Cancelled or failed: what
 * wasn't applied is discarded, the target kept it as it was (R95); the one that failed keeps its error.
 */
export function settleCollections(list: CollectionProgressEntry[], end: OperationEnd): CollectionProgressEntry[] {
  if (end === "done") return list.map((entry) => (entry.status === "applied" ? entry : completed(entry)));
  return list.map((entry) => (entry.status === "applied" || entry.status === "failed" ? entry : { ...entry, status: "discarded" }));
}

/** 0–100 of one collection; a copied one is whole even though the target doesn't have it yet. */
export function collectionPercent(entry: CollectionProgressEntry): number {
  if (entry.status === "copied" || entry.status === "applied") return FULL;
  if (entry.total <= 0) return 0;
  return Math.round(Math.min(entry.done / entry.total, 1) * FULL);
}

/** The collections by database, in the order of the plan. */
export function byDatabase(list: CollectionProgressEntry[]): DatabaseGroup[] {
  const groups = new Map<string, CollectionProgressEntry[]>();
  for (const entry of list) groups.set(entry.db, [...(groups.get(entry.db) ?? []), entry]);
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

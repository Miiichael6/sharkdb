// Long-running jobs over collections (backup, restore, sync): their progress and results.

/** Progress of a running job. `done`/`total` count documents in a backup or a sync and bytes in a restore. */
export interface JobProgress {
  job: string;
  collection: string;
  /** Position of the current collection (from 0) and how many there are. */
  index: number;
  count: number;
  done: number;
  total: number;
}

export interface CollectionResult {
  collection: string;
  documents: number;
  /** Documents not written because their `_id` already existed. */
  duplicates: number;
  indexes: number;
}

/** Overall progress of a job, 0–100: whole collections done plus the share of the current one. */
export function progressPercent(p: Pick<JobProgress, "index" | "count" | "done" | "total">): number {
  if (p.count <= 0) return 0;
  const current = p.total > 0 ? Math.min(p.done / p.total, 1) : 0;
  return Math.round(((p.index + current) / p.count) * 100);
}

/** "64 de 69": the collection in course among all of the job's. */
export const progressCount = (p: Pick<JobProgress, "index" | "count">) => `${p.index + 1} de ${p.count}`;

const sum = (results: CollectionResult[], field: "documents" | "duplicates") =>
  results.reduce((total, r) => total + r[field], 0);

export const totalDocuments = (results: CollectionResult[]) => sum(results, "documents");

export const collectionsLabel = (n: number) => `${n} ${n === 1 ? "colección" : "colecciones"}`;

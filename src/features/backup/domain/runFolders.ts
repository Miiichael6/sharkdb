// Where each run of a schedule goes (D16): `<dir>/<name>/<AAAA-MM-DD_HHMM>`, and which old runs to delete.
import type { DatabaseCatalog } from "../../../shared/domain/selection";
import { currentDatabases, type BackupRequest } from "./backupSpec";
import { BACKUP_REQUIRED, NOTHING_LEFT, dateStamp, folderSafeName, pad, type BackupSchedule } from "./schedule";

/** Runs kept in a schedule's folder: older ones are deleted after each run that ends well (D16). */
export const RETAINED_RUNS = 7;

/** A run's folder, and whether its backup ended well: one that failed or was cancelled is marked. */
export interface RunFolder {
  name: string;
  complete: boolean;
}

/** "2026-10-31_0230", or "2026-10-31_0230_2" for a second run in the same minute. */
const RUN_NAME = /^(\d{4}-\d{2}-\d{2}_\d{4})(?:_(\d+))?$/;
const STAMP_PARTS = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})$/;

/**
 * Unfinished runs that started this recently are never deleted: another SharkDB window may still be
 * writing them (error 60).
 */
export const RECENT_UNFINISHED_MS = 24 * 60 * 60 * 1000;

/** "2026-10-31_0230": a run's folder, sorted by date when listed by name. */
export const runStamp = (at: Date) => `${dateStamp(at)}_${pad(at.getHours())}${pad(at.getMinutes())}`;

/** A folder a run made: anything else in the schedule's folder is never touched. */
export const isRunName = (name: string) => RUN_NAME.test(name);

/** When the run of folder `name` started. */
function runStart(name: string): Date {
  const [, year, month, day, hours, minutes] = STAMP_PARTS.exec(RUN_NAME.exec(name)![1])!.map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

const separatorOf = (dir: string) => (dir.includes("\\") ? "\\" : "/");

/** The folder that holds every run of a schedule: `<dir>/<name>`, with the separator `dir` already uses. */
export function runsParent(dir: string, name: string): string {
  const base = dir.trim().replace(/[\\/]+$/, "");
  return [base, folderSafeName(name)].join(separatorOf(dir));
}

/** Each run in its own folder (D16): `<parent>/<run>`, where `run` is the name the backend reserved for it. */
export const runFolder = (parent: string, run: string) => [parent, run].join(separatorOf(parent));

/** A run's backup, and what it chose that no longer exists (skipped, not a failure). */
export interface RunPlan {
  request: BackupRequest;
  missing: string[];
}

/**
 * The backup a run makes, with the collections the source has now (`catalog`): whole databases take
 * the new ones, and gone ones are skipped (error 47). Its `dir` is the schedule's folder
 * (`runsParent`): the run's own folder inside is reserved when it starts. Throws the message to show
 * when nothing was chosen yet, or nothing chosen exists anymore.
 */
export function runRequest(schedule: BackupSchedule, catalog: DatabaseCatalog[]): RunPlan {
  if (!schedule.backup) throw BACKUP_REQUIRED;
  const { databases, missing } = currentDatabases(schedule.backup.databases, catalog);
  if (!databases.length) throw NOTHING_LEFT;
  return { request: { ...schedule.backup, databases, dir: runsParent(schedule.backup.dir, schedule.name) }, missing };
}

/** Oldest first: by date, then "_2" after the run without a suffix. */
function compareRuns(a: string, b: string): number {
  const [, stampA, repeatA] = RUN_NAME.exec(a)!;
  const [, stampB, repeatB] = RUN_NAME.exec(b)!;
  return stampA === stampB ? Number(repeatA ?? 1) - Number(repeatB ?? 1) : stampA < stampB ? -1 : 1;
}

/**
 * The runs to delete at `now` so that only the newest `keep` complete ones stay; folders that aren't
 * runs don't count. Unfinished runs never take a complete one's place (error 46): those older than
 * the newest complete run go too, unless they started less than `RECENT_UNFINISHED_MS` ago (another
 * window may still be writing them, error 60); a newer one may still be running.
 */
export function runsToDelete(folders: RunFolder[], now: Date, keep = RETAINED_RUNS): string[] {
  const runs = folders.filter((run) => isRunName(run.name)).sort((a, b) => compareRuns(a.name, b.name));
  const complete = runs.filter((run) => run.complete);
  const kept = complete.slice(Math.max(0, complete.length - keep));
  const newest = kept[kept.length - 1]?.name;
  const recent = (run: RunFolder) => now.getTime() - runStart(run.name).getTime() < RECENT_UNFINISHED_MS;
  const goes = (run: RunFolder) =>
    run.complete ? !kept.includes(run) : newest !== undefined && compareRuns(run.name, newest) < 0 && !recent(run);
  return runs.filter(goes).map((run) => run.name);
}

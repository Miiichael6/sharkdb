import type { CollectionResult } from "../../../shared/domain/jobs";
import type { DatabaseCatalog } from "../../../shared/domain/selection";
import type { BackupRequest, RestoreRequest } from "../domain/backupSpec";
import type { RunFolder } from "../domain/runFolders";
import type { SystemAlert } from "../domain/runAlert";
import type { BackupSchedule } from "../domain/schedule";

/** Where the backup schedules are kept. What it loads may come from an older version: fields can be missing. */
export interface ScheduleStore {
  load(): Promise<(Partial<BackupSchedule> & { id: string })[]>;
  save(schedules: BackupSchedule[]): Promise<void>;
}

/** The run folders inside a schedule's folder (`<dir>/<name>`); only names that look like runs are listed or removed. */
export interface RunFolders {
  /**
   * Makes the folder of a run starting at `stamp`, marked unfinished: `stamp`, or `stamp_2`, `_3`…
   * when taken, even by another SharkDB window at the same moment. Resolves to its name.
   */
  create(parent: string, stamp: string): Promise<string>;
  /** Run folders in `parent`, and whether each ended well; none when it doesn't exist yet. */
  list(parent: string): Promise<RunFolder[]>;
  remove(parent: string, names: string[]): Promise<void>;
}

/**
 * The turn to run a schedule, shared by every SharkDB window (each one is a process of its own): at
 * most one holds it, and none while another runs a backup, restore or sync (error 60).
 */
export interface ScheduleTurn {
  /** Takes the turn; false when another window (or this one) is at it. */
  take(): Promise<boolean>;
  release(): Promise<void>;
}

/** The operating system's notifications, seen even with the app in the background. */
export interface SystemNotifier {
  show(alert: SystemAlert): Promise<void>;
}

/** The databases of a connected source, with the collections they have now. */
export interface SourceCatalog {
  databaseCatalog(sid: string): Promise<DatabaseCatalog[]>;
}

/** Calls `listener` at the start of every minute; resolves to the function that stops it. */
export interface MinuteClock {
  onMinute(listener: () => void): Promise<() => void>;
}

/** The backend that copies databases to and from backup folders. `job` identifies a run to cancel it. */
export interface BackupGateway {
  backup(job: string, request: BackupRequest): Promise<CollectionResult[]>;
  restore(job: string, request: RestoreRequest): Promise<CollectionResult[]>;
  /** Databases saved in a backup folder, with their collections. */
  readCatalog(dir: string): Promise<DatabaseCatalog[]>;
  /** Shows a backup folder in the system's file explorer. */
  openFolder(dir: string): Promise<void>;
}

export interface FolderPicker {
  pickFolder(title: string): Promise<string | null>;
}

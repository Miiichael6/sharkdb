import type { CollectionResult } from "../../../shared/domain/jobs";
import type { DatabaseCatalog } from "../../../shared/domain/selection";
import type { BackupRequest, RestoreRequest } from "../domain/backupSpec";
import type { SystemAlert } from "../domain/runAlert";
import type { BackupSchedule } from "../domain/schedule";

/** Where the backup schedules are kept. What it loads may come from an older version: fields can be missing. */
export interface ScheduleStore {
  load(): Promise<(Partial<BackupSchedule> & { id: string })[]>;
  save(schedules: BackupSchedule[]): Promise<void>;
}

/** The run folders inside a schedule's folder (`<dir>/<name>`); only names that look like runs are listed or removed. */
export interface RunFolders {
  /** Run folder names in `parent`; none when it doesn't exist yet. */
  list(parent: string): Promise<string[]>;
  remove(parent: string, names: string[]): Promise<void>;
}

/** The operating system's notifications, seen even with the app in the background. */
export interface SystemNotifier {
  show(alert: SystemAlert): Promise<void>;
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

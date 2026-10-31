import type { CollectionResult } from "../../../shared/domain/jobs";
import type { DatabaseCatalog } from "../../../shared/domain/selection";
import type { BackupRequest, RestoreRequest } from "../domain/backupSpec";

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

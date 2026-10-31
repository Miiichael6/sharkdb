import type { BackupEntry, BackupRequest, RestoreRequest } from "../domain/backupSpec";
import type { CollectionResult } from "../../../shared/domain/jobs";

/** The backend that copies databases to and from backup folders. `job` identifies a run to cancel it. */
export interface BackupGateway {
  backup(job: string, request: BackupRequest): Promise<CollectionResult[]>;
  restore(job: string, request: RestoreRequest): Promise<CollectionResult[]>;
  /** Collections saved in a backup folder. */
  readFolder(dir: string): Promise<BackupEntry[]>;
}

export interface FolderPicker {
  pickFolder(title: string): Promise<string | null>;
}

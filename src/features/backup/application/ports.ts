import type { BackupEntry, BackupRequest, CollectionResult, JobProgress, RestoreRequest } from "../domain/backupSpec";

/** The backend that copies databases to and from backup folders. `job` identifies a run to cancel it. */
export interface BackupGateway {
  backup(job: string, request: BackupRequest): Promise<CollectionResult[]>;
  restore(job: string, request: RestoreRequest): Promise<CollectionResult[]>;
  cancel(job: string): Promise<void>;
  /** Collections saved in a backup folder. */
  readFolder(dir: string): Promise<BackupEntry[]>;
  /** Progress of every job; resolves to the function that stops listening. */
  onProgress(listener: (progress: JobProgress) => void): Promise<() => void>;
}

export interface FolderPicker {
  pickFolder(title: string): Promise<string | null>;
}

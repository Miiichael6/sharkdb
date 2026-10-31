import {
  validateBackup,
  validateRestore,
  type BackupRequest,
  type CollectionResult,
  type JobProgress,
  type RestoreRequest,
} from "../domain/backupSpec";
import type { BackupGateway, FolderPicker } from "./ports";

export type BackupService = ReturnType<typeof createBackupService>;

/** A started backup or restore: its outcome and how to stop it. */
export interface RunningJob {
  result: Promise<CollectionResult[]>;
  cancel: () => void;
}

type OnProgress = (progress: JobProgress) => void;

export function createBackupService(gateway: BackupGateway, picker: FolderPicker, newJobId: () => string = () => crypto.randomUUID()) {
  function start(run: (job: string) => Promise<CollectionResult[]>, onProgress: OnProgress): RunningJob {
    const job = newJobId();
    const result = (async () => {
      // Listening first, so the first progress event isn't missed.
      const stop = await gateway.onProgress((p) => p.job === job && onProgress(p));
      try {
        return await run(job);
      } finally {
        stop();
      }
    })();
    return { result, cancel: () => void gateway.cancel(job) };
  }

  return {
    backup: (request: BackupRequest, onProgress: OnProgress) =>
      start(async (job) => gateway.backup(job, validateBackup(request)), onProgress),
    restore: (request: RestoreRequest, onProgress: OnProgress) =>
      start(async (job) => gateway.restore(job, validateRestore(request)), onProgress),
    readFolder: (dir: string) => gateway.readFolder(dir.trim()),
    pickFolder: (title: string) => picker.pickFolder(title),
  };
}

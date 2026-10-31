import type { OnProgress, StartJob } from "../../../shared/application/jobRunner";
import { validateBackup, validateRestore, type BackupRequest, type RestoreRequest } from "../domain/backupSpec";
import type { BackupGateway, FolderPicker } from "./ports";

export type BackupService = ReturnType<typeof createBackupService>;

export function createBackupService(gateway: BackupGateway, picker: FolderPicker, start: StartJob) {
  return {
    backup: (request: BackupRequest, onProgress: OnProgress) =>
      start(async (job) => gateway.backup(job, validateBackup(request)), onProgress),
    restore: (request: RestoreRequest, onProgress: OnProgress) =>
      start(async (job) => gateway.restore(job, validateRestore(request)), onProgress),
    readCatalog: (dir: string) => gateway.readCatalog(dir.trim()),
    openFolder: (dir: string) => gateway.openFolder(dir),
    pickFolder: (title: string) => picker.pickFolder(title),
  };
}

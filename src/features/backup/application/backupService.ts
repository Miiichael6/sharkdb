import type { JobListener, StartJob } from "../../../shared/application/jobRunner";
import { validateBackup, validateRestore, type BackupRequest, type RestoreRequest } from "../domain/backupSpec";
import type { BackupGateway, FolderPicker } from "./ports";

export type BackupService = ReturnType<typeof createBackupService>;

export function createBackupService(gateway: BackupGateway, picker: FolderPicker, start: StartJob) {
  return {
    backup: (request: BackupRequest, listener: JobListener) =>
      start(async (job) => gateway.backup(job, validateBackup(request)), listener),
    restore: (request: RestoreRequest, listener: JobListener) =>
      start(async (job) => gateway.restore(job, validateRestore(request)), listener),
    readCatalog: (dir: string) => gateway.readCatalog(dir.trim()),
    openFolder: (dir: string) => gateway.openFolder(dir),
    pickFolder: (title: string) => picker.pickFolder(title),
  };
}

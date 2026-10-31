import { listen } from "@tauri-apps/api/event";
import { call } from "../../../shared/infrastructure/tauri";
import type { BackupGateway } from "../application/ports";
import type { JobProgress } from "../domain/backupSpec";

const PROGRESS_EVENT = "backup-progress";

export const tauriBackupGateway: BackupGateway = {
  backup: (job, request) => call("backup_database", { job, request }),
  restore: (job, request) => call("restore_database", { job, request }),
  cancel: (job) => call("cancel_backup_job", { job }),
  readFolder: (dir) => call("read_backup_folder", { dir }),
  onProgress: (listener) => listen<JobProgress>(PROGRESS_EVENT, (e) => listener(e.payload)),
};

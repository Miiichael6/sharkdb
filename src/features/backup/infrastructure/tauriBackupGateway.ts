import { call } from "../../../shared/infrastructure/tauri";
import type { BackupGateway } from "../application/ports";

export const tauriBackupGateway: BackupGateway = {
  backup: (job, request) => call("backup_database", { job, request }),
  restore: (job, request) => call("restore_database", { job, request }),
  readFolder: (dir) => call("read_backup_folder", { dir }),
};

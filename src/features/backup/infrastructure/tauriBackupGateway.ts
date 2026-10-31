import { call } from "../../../shared/infrastructure/tauri";
import type { BackupGateway } from "../application/ports";

export const tauriBackupGateway: BackupGateway = {
  backup: (job, request) => call("backup_databases", { job, request }),
  restore: (job, request) => call("restore_databases", { job, request }),
  readCatalog: (dir) => call("read_backup_catalog", { dir }),
  openFolder: (dir) => call("open_backup_folder", { dir }),
};

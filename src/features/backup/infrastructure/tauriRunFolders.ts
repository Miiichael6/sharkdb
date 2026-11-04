import { call } from "../../../shared/infrastructure/tauri";
import type { RunFolders } from "../application/ports";

export const tauriRunFolders: RunFolders = {
  create: (parent, stamp) => call("create_backup_run", { parent, stamp }),
  list: (parent) => call("list_backup_runs", { parent }),
  remove: (parent, names) => call("delete_backup_runs", { parent, names }),
};

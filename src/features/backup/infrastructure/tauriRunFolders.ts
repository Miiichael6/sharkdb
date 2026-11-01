import { call } from "../../../shared/infrastructure/tauri";
import type { RunFolders } from "../application/ports";

export const tauriRunFolders: RunFolders = {
  list: (parent) => call("list_backup_runs", { parent }),
  remove: (parent, names) => call("delete_backup_runs", { parent, names }),
};

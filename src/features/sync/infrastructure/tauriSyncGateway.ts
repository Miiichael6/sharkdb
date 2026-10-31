import { call } from "../../../shared/infrastructure/tauri";
import type { SyncGateway } from "../application/ports";

export const tauriSyncGateway: SyncGateway = {
  databaseCatalog: (sid) => call("database_catalog", { sid }),
  sync: (job, request) => call("sync_databases", { job, request }),
};

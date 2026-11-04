import type { OnProgress, StartJob } from "../../../shared/application/jobRunner";
import type { Leftover } from "../domain/leftovers";
import { validateSync, type SyncRequest } from "../domain/syncPlan";
import type { SyncGateway } from "./ports";

export type SyncService = ReturnType<typeof createSyncService>;

export function createSyncService(gateway: SyncGateway, start: StartJob) {
  return {
    databaseCatalog: (sid: string) => gateway.databaseCatalog(sid),
    sync: (request: SyncRequest, onProgress: OnProgress) =>
      start(async (job) => gateway.sync(job, validateSync(request)), onProgress),
    findLeftovers: (sid: string) => gateway.findLeftovers(sid),
    dropLeftovers: (sid: string, leftovers: Leftover[]) => gateway.dropLeftovers(sid, leftovers),
  };
}

import type { JobListener, StartJob } from "../../../shared/application/jobRunner";
import type { Leftover } from "../domain/leftovers";
import { validateSync, type SyncRequest } from "../domain/syncPlan";
import type { SyncGateway } from "./ports";

export type SyncService = ReturnType<typeof createSyncService>;

export function createSyncService(gateway: SyncGateway, start: StartJob) {
  return {
    databaseCatalog: (sid: string) => gateway.databaseCatalog(sid),
    sync: (request: SyncRequest, listener: JobListener) =>
      start(async (job) => gateway.sync(job, validateSync(request)), listener),
    findLeftovers: (sid: string) => gateway.findLeftovers(sid),
    dropLeftovers: (sid: string, leftovers: Leftover[]) => gateway.dropLeftovers(sid, leftovers),
  };
}

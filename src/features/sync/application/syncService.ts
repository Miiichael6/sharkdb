import type { JobListener, StartJob } from "../../../shared/application/jobRunner";
import type { MongoConnection } from "../../connections/domain/connection";
import { validateDocumentSync, type DocumentSyncRequest } from "../domain/documentSync";
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
    /** What the confirmation shows: the picked documents read whole from the source (R97, R99). */
    loadFullDocuments: ({ sourceSid, db, collection, ids }: DocumentSyncRequest) =>
      gateway.loadFullDocuments(sourceSid, db, collection, ids),
    /** Checked against the registered `connections` (only to a lower environment, D26) before it starts. */
    syncDocuments: (request: DocumentSyncRequest, connections: MongoConnection[], listener: JobListener) =>
      start(async (job) => gateway.syncDocuments(job, validateDocumentSync(request, connections)), listener),
  };
}

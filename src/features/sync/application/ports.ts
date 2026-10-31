import type { CollectionResult } from "../../../shared/domain/jobs";
import type { DatabaseCatalog, SyncRequest } from "../domain/syncPlan";

/** The backend that lists a connection's databases and copies collections between connections. `job` identifies a run to cancel it. */
export interface SyncGateway {
  databaseCatalog(sid: string): Promise<DatabaseCatalog[]>;
  sync(job: string, request: SyncRequest): Promise<CollectionResult[]>;
}

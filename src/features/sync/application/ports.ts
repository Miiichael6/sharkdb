import type { CollectionResult } from "../../../shared/domain/jobs";
import type { DatabaseCatalog } from "../../../shared/domain/selection";
import type { Leftover } from "../domain/leftovers";
import type { SyncRequest } from "../domain/syncPlan";

/** The backend that lists a connection's databases and copies collections between connections. `job` identifies a run to cancel it. */
export interface SyncGateway {
  databaseCatalog(sid: string): Promise<DatabaseCatalog[]>;
  sync(job: string, request: SyncRequest): Promise<CollectionResult[]>;
  /** Provisional collections that interrupted jobs left in the connection. */
  findLeftovers(sid: string): Promise<Leftover[]>;
  /** Drops them; the backend refuses anything that isn't a provisional collection. */
  dropLeftovers(sid: string, leftovers: Leftover[]): Promise<void>;
}

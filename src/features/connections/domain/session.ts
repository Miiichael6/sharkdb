import type { MongoConnection } from "./connection";

export interface DatabaseInfo {
  name: string;
  sizeOnDisk: number;
  empty: boolean;
}

export interface ServerInfo {
  version: string;
  databases: DatabaseInfo[];
}

/** An open connection: the saved settings plus what the server reported on connect. */
export interface Session {
  conn: MongoConnection;
  info: ServerInfo;
  /** Read-only switch: while on, the backend rejects every write of this session. */
  safeMode: boolean;
}

/**
 * A connection's session lent to a sync, backup or restore: the one the user opened, or one opened
 * apart that the explorer doesn't show. `release` gives it back (closing the one opened apart).
 */
export interface BorrowedSession {
  session: Session;
  release: () => Promise<void>;
}

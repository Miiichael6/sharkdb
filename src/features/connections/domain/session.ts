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
}

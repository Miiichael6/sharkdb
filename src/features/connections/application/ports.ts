import type { MongoConnection } from "../domain/connection";
import type { ServerInfo } from "../domain/session";

/** Where saved connections are persisted. */
export interface ConnectionStore {
  load(): Promise<MongoConnection[]>;
  save(connections: MongoConnection[]): Promise<void>;
}

/** Opens and closes server sessions, keyed by connection id. */
export interface SessionGateway {
  test(uri: string): Promise<ServerInfo>;
  open(id: string, uri: string): Promise<ServerInfo>;
  close(id: string): Promise<void>;
}

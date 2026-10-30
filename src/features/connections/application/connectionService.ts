import { buildUri, type MongoConnection } from "../domain/connection";
import type { Session } from "../domain/session";
import type { ConnectionStore, SessionGateway } from "./ports";

export type ConnectionService = ReturnType<typeof createConnectionService>;

export function createConnectionService(store: ConnectionStore, gateway: SessionGateway) {
  return {
    list: () => store.load(),
    save: (connections: MongoConnection[]) => store.save(connections),
    test: (conn: MongoConnection) => gateway.test(buildUri(conn)),
    async open(conn: MongoConnection): Promise<Session> {
      return { conn, info: await gateway.open(conn.id, buildUri(conn)) };
    },
    close: (id: string) => gateway.close(id),
  };
}

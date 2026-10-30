import { buildUri, type MongoConnection } from "../domain/connection";
import { migrateConnection } from "../domain/migrate";
import type { Session } from "../domain/session";
import { sshTunnelConfig } from "../domain/ssh";
import type { ConnectionStore, FilePicker, SessionGateway } from "./ports";

export type ConnectionService = ReturnType<typeof createConnectionService>;

export function createConnectionService(store: ConnectionStore, gateway: SessionGateway, files: FilePicker) {
  return {
    list: async () => (await store.load()).map(migrateConnection),
    save: (connections: MongoConnection[]) => store.save(connections),
    test: (conn: MongoConnection) => gateway.test(buildUri(conn), sshTunnelConfig(conn.ssh)),
    async open(conn: MongoConnection): Promise<Session> {
      return { conn, info: await gateway.open(conn.id, buildUri(conn), sshTunnelConfig(conn.ssh)) };
    },
    close: (id: string) => gateway.close(id),
    pickFile: (title: string) => files.pick(title),
  };
}

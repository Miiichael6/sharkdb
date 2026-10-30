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
    /** Protected connections open in safe mode. */
    async open(conn: MongoConnection): Promise<Session> {
      const safeMode = conn.protected;
      return { conn, safeMode, info: await gateway.open(conn.id, buildUri(conn), sshTunnelConfig(conn.ssh), safeMode) };
    },
    /** Turns the read-only switch of an open session on or off; returns the session as it is now. */
    async setSafeMode(session: Session, enabled: boolean): Promise<Session> {
      await gateway.setSafeMode(session.conn.id, enabled);
      return { ...session, safeMode: enabled };
    },
    close: (id: string) => gateway.close(id),
    pickFile: (title: string) => files.pick(title),
  };
}

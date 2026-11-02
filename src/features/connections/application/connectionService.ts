import { buildUri, protectedAmong, type MongoConnection } from "../domain/connection";
import { migrateConnection } from "../domain/migrate";
import type { BorrowedSession, Session } from "../domain/session";
import { sshTunnelConfig } from "../domain/ssh";
import type { ConnectionStore, FilePicker, SessionGateway } from "./ports";

export type ConnectionService = ReturnType<typeof createConnectionService>;

export function createConnectionService(store: ConnectionStore, gateway: SessionGateway, files: FilePicker) {
  return {
    list: async () => (await store.load()).map(migrateConnection),
    save: (connections: MongoConnection[]) => store.save(connections),
    test: (conn: MongoConnection) => gateway.test(buildUri(conn), sshTunnelConfig(conn.ssh)),
    /** Protected connections, and those on the server of a protected one of `all`, open in safe mode. */
    async open(conn: MongoConnection, all: MongoConnection[] = []): Promise<Session> {
      const safeMode = protectedAmong(conn, all);
      return { conn, safeMode, info: await gateway.open(conn.id, buildUri(conn), sshTunnelConfig(conn.ssh), safeMode) };
    },
    /** Turns the read-only switch of an open session on or off; returns the session as it is now. */
    async setSafeMode(session: Session, enabled: boolean): Promise<Session> {
      await gateway.setSafeMode(session.conn.id, enabled);
      return { ...session, safeMode: enabled };
    },
    close: (id: string) => gateway.close(id),
    /** Opens `conn` apart from the sessions, for an operation; protected ones stay read-only too. */
    async borrow(conn: MongoConnection, all: MongoConnection[] = []): Promise<BorrowedSession> {
      const safeMode = protectedAmong(conn, all);
      const info = await gateway.openDetached(conn.id, buildUri(conn), sshTunnelConfig(conn.ssh), safeMode);
      let released = false;
      const release = async () => {
        if (released) return;
        released = true;
        await gateway.closeDetached(conn.id);
      };
      return { session: { conn, safeMode, info }, release };
    },
    pickFile: (title: string) => files.pick(title),
  };
}

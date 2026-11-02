// Registered connections offered as one end of sync, backup or restore: a closed one is connected when chosen.
import { displayName, neverModified, neverModifiedAmong, type MongoConnection, type Tag } from "./connection";
import type { Session } from "./session";

export interface ConnectionOption {
  id: string;
  name: string;
  tag: Tag;
  connected: boolean;
  /** Why it can't be written to now (safe mode on), shown next to it. */
  blocked?: string;
}

export const PROTECTED_TARGET = "Conexión protegida o de producción: nunca se modifica desde aquí";
export const SAFE_MODE_TARGET = "Safe mode activo: desactívalo para escribir en ella";
export const NO_TARGET = "No hay ninguna conexión que se pueda modificar";

/** Why a session can't be written to by sync or restore (D5, D7), or undefined when it can. */
export function writeBlockReason(session: Session): string | undefined {
  if (neverModified(session.conn)) return PROTECTED_TARGET;
  if (session.safeMode) return SAFE_MODE_TARGET;
  return undefined;
}

function connectionOptions(connections: MongoConnection[], sessions: Session[], exceptId: string): ConnectionOption[] {
  return connections
    .filter((conn) => conn.id !== exceptId)
    .map((conn) => {
      const session = sessions.find((s) => s.conn.id === conn.id);
      return {
        id: conn.id,
        name: displayName(conn),
        tag: conn.tag,
        connected: !!session,
        blocked: session && writeBlockReason(session),
      };
    });
}

/**
 * Connections offered to read from: every registered one, since it's only read. The destination too:
 * choosing it as source moves the destination (it never offers the source), so the ends can be swapped.
 */
export const sourceOptions = (connections: MongoConnection[], sessions: Session[]) =>
  connectionOptions(connections, sessions, "").map(({ blocked: _, ...source }) => source);

/**
 * Connections offered to write to: every registered one but `exceptId`; protected or production ones,
 * and those pointing at the same server, never appear (D7), open or closed, so nothing is ever
 * written into production.
 */
export const targetOptions = (connections: MongoConnection[], sessions: Session[], exceptId = "") =>
  connectionOptions(
    connections.filter((conn) => !neverModifiedAmong(conn, connections)),
    sessions,
    exceptId,
  );

/**
 * The chosen destination while it's still offered, even when it's blocked (safe mode): it stays chosen
 * with its reason instead of jumping to another environment. Otherwise the first usable one, or "".
 */
export const pickTarget = (targets: ConnectionOption[], currentId: string) =>
  (targets.find((t) => t.id === currentId) ?? targets.find((t) => !t.blocked))?.id ?? "";

/** Name and environment tag of a registered connection, for the operation and its confirmation. */
export function connectionEndpoint(connections: MongoConnection[], id: string): { name: string; tag?: Tag } {
  const conn = connections.find((c) => c.id === id);
  return conn ? { name: displayName(conn), tag: conn.tag } : { name: id };
}

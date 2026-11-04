// The connection each shell tab runs on, as the bar shows it: a dot in the connection's colour
// and, for production or a protected connection, a fixed sign that doesn't rely on that colour.
import {
  displayName,
  neverModified,
  PRODUCTION_TAG,
  protectedAmong,
  type MongoConnection,
} from "../../connections/domain/connection";
import type { BarEntry } from "./splitTabs";
import type { ShellTab } from "./tabs";

/** Why a tab's connection must be handled with care, if it must. */
export type ConnectionGuard = "production" | "protected";

export const GUARD_LABELS: Record<ConnectionGuard, string> = {
  production: "producción",
  protected: "protegida",
};

export interface TabConnection {
  id: string;
  name: string;
  color: string;
  guard: ConnectionGuard | null;
}

function guardOf(conn: MongoConnection, all: MongoConnection[]): ConnectionGuard | null {
  if (!neverModified(conn) && !protectedAmong(conn, all)) return null;
  return conn.tag === PRODUCTION_TAG ? "production" : "protected";
}

/** The connection `tab` runs on; null when it's no longer registered (deleted). */
export function paneConnection(tab: ShellTab, connections: MongoConnection[]): TabConnection | null {
  const conn = connections.find((c) => c.id === tab.sid);
  return conn ? { id: conn.id, name: displayName(conn), color: conn.color, guard: guardOf(conn, connections) } : null;
}

/**
 * The connections of a bar entry, in pane order: one per distinct connection (a split on a single
 * connection shows one colour), none for a deleted connection.
 */
export function tabConnections(entry: Pick<BarEntry, "panes">, connections: MongoConnection[]): TabConnection[] {
  const found: TabConnection[] = [];
  for (const pane of entry.panes) {
    const conn = paneConnection(pane, connections);
    if (conn && !found.some((s) => s.id === conn.id)) found.push(conn);
  }
  return found;
}

/** `name (producción)`, or the label the tab was opened with when the connection is gone. */
function connectionLabel(tab: ShellTab, conn: TabConnection | null): string {
  if (!conn) return tab.serverLabel;
  return conn.guard ? `${conn.name} (${GUARD_LABELS[conn.guard]})` : conn.name;
}

/** Tooltip of a bar entry: per pane, its connection (and environment), database and script file. */
export function tabTooltip(entry: Pick<BarEntry, "panes">, connections: MongoConnection[]): string {
  return entry.panes
    .map((tab) => {
      const where = `${connectionLabel(tab, paneConnection(tab, connections))} · ${tab.db}`;
      return tab.filePath ? `${where}\n${tab.filePath}` : where;
    })
    .join("\n");
}

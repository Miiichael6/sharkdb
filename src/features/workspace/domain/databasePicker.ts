// "Abrir base de datos" window: what it receives and answers, its address line and its search. Pure, no React.
import type { Tag } from "../../connections/domain/connection";

export const DATABASE_PICKER_VIEW = "database-picker";

/** What the window shows: every database of one connection, said once at the top. */
export interface DatabasePickerData {
  connection: string;
  tag: Tag;
  host: string;
  /** Empty for an SRV address or a replica set: it has no single port. */
  port: string;
  /** Favorites first, as in the explorer. */
  databases: string[];
  favorites: string[];
}

/** The database to open a shell on; closing gives null instead. */
export interface DatabasePickerResult {
  db: string;
}

const HOST_PORT = /^(.+):(\d+)$/;

/** Host and port of a `host:port` address; several hosts or an SRV name stay whole, without port. */
export function splitAddress(address: string): { host: string; port: string } {
  const match = !address.includes(",") && HOST_PORT.exec(address);
  return match ? { host: match[1], port: match[2] } : { host: address, port: "" };
}

/** The databases whose name contains `query` (case insensitive), in the given order. */
export function filterDatabases(databases: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  return q ? databases.filter((db) => db.toLowerCase().includes(q)) : databases;
}

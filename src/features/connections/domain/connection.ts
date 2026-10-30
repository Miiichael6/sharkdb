import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_READ_PREFERENCE,
  advancedParams,
  newTlsFiles,
  takeAdvancedParams,
  type AdvancedOptions,
} from "./advancedOptions";
import { newSshSettings, type SshSettings } from "./ssh";

export type Tag = "local" | "development" | "testing" | "staging" | "production";
export type ConnectMode = "fields" | "uri";

export interface MongoConnection extends AdvancedOptions {
  id: string;
  name: string;
  driver: "mongodb";
  tag: Tag;
  color: string;
  mode: ConnectMode;
  uri: string;
  host: string;
  port: number;
  srv: boolean;
  username: string;
  password: string;
  authDb: string;
  database: string;
  /** Extra query string, e.g. `retryWrites=true&w=majority`. */
  options: string;
  /** Tunnel used in both modes (fields and URI). */
  ssh: SshSettings;
  /** Production-like: never modified, so its sessions open in safe mode (read-only). */
  protected: boolean;
}

export const TAGS: Tag[] = ["local", "development", "testing", "staging", "production"];

export const COLORS = [
  "#0f7a3d",
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#d97706",
  "#dc2626",
  "#db2777",
  "#4b5563",
];

export const DEFAULT_PORT = 27017;

export function newConnection(): MongoConnection {
  return {
    id: crypto.randomUUID(),
    name: "",
    driver: "mongodb",
    tag: "local",
    color: COLORS[0],
    mode: "fields",
    uri: "mongodb://localhost:27017",
    host: "localhost",
    port: DEFAULT_PORT,
    srv: false,
    username: "",
    password: "",
    authDb: "admin",
    database: "",
    tls: false,
    tlsFiles: newTlsFiles(),
    replicaSet: "",
    readPreference: DEFAULT_READ_PREFERENCE,
    connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
    options: "",
    ssh: newSshSettings(),
    protected: false,
  };
}

export function displayName(c: MongoConnection): string {
  return c.name.trim() || hostLabel(c) || "Sin nombre";
}

/** Short `host:port` line shown under the connection name. */
export function hostLabel(c: MongoConnection): string {
  if (c.mode === "uri") {
    const parsed = parseUri(c.uri);
    return parsed ? parsed.hosts : c.uri;
  }
  if (!c.host.trim()) return "";
  return c.srv ? c.host.trim() : `${c.host.trim()}:${c.port || DEFAULT_PORT}`;
}

const enc = encodeURIComponent;

export function buildUri(c: MongoConnection, maskPassword = false): string {
  if (c.mode === "uri") {
    return maskPassword ? maskUri(c.uri.trim()) : c.uri.trim();
  }
  const scheme = c.srv ? "mongodb+srv" : "mongodb";
  const user = c.username.trim();
  const pass = maskPassword && c.password ? "••••" : enc(c.password);
  const creds = user ? `${enc(user)}${c.password ? `:${pass}` : ""}@` : "";
  const host = c.srv ? c.host.trim() : `${c.host.trim()}:${c.port || DEFAULT_PORT}`;

  const params: string[] = [];
  if (user && c.authDb.trim()) params.push(`authSource=${enc(c.authDb.trim())}`);
  params.push(...advancedParams(c));
  const extra = c.options.trim().replace(/^\?/, "");
  if (extra) params.push(extra);

  const db = c.database.trim() ? enc(c.database.trim()) : "";
  const query = params.length ? `?${params.join("&")}` : "";
  return `${scheme}://${creds}${host}/${db}${query}`;
}

export function maskUri(uri: string): string {
  return uri.replace(/^(mongodb(?:\+srv)?:\/\/[^:@/]*:)([^@/]*)@/, "$1••••@");
}

interface ParsedUri {
  srv: boolean;
  username: string;
  password: string;
  /** Raw host list, may contain several `host:port` entries separated by commas. */
  hosts: string;
  database: string;
  params: URLSearchParams;
}

const URI_RE =
  /^(mongodb(?:\+srv)?):\/\/(?:([^:@/]*)(?::([^@/]*))?@)?([^/?]+)\/?([^?]*)(?:\?(.*))?$/;

export function parseUri(uri: string): ParsedUri | null {
  const m = URI_RE.exec(uri.trim());
  if (!m) return null;
  const dec = (s?: string) => {
    try {
      return decodeURIComponent(s ?? "");
    } catch {
      return s ?? "";
    }
  };
  return {
    srv: m[1] === "mongodb+srv",
    username: dec(m[2]),
    password: dec(m[3]),
    hosts: m[4],
    database: dec(m[5]),
    params: new URLSearchParams(m[6] ?? ""),
  };
}

/**
 * Copies a URI into the field-based form. Returns null when the URI can't be expressed as
 * fields (invalid, or a replica-set list with several hosts).
 */
export function fieldsFromUri(c: MongoConnection, uri: string): MongoConnection | null {
  const p = parseUri(uri);
  if (!p || p.hosts.includes(",")) return null;

  const [host, port] = p.srv ? [p.hosts, ""] : p.hosts.split(":");
  const params = new URLSearchParams(p.params);
  const authDb = params.get("authSource") ?? (p.username ? "admin" : c.authDb);
  params.delete("authSource");
  const advanced = takeAdvancedParams(params, c);

  return {
    ...c,
    mode: "fields",
    srv: p.srv,
    host,
    port: Number(port) || DEFAULT_PORT,
    username: p.username,
    password: p.password,
    authDb,
    database: p.database,
    ...advanced,
    options: params.toString(),
  };
}

/** Inserts `conn` or replaces the one with the same id. */
export const upsertConnection = (list: MongoConnection[], conn: MongoConnection) =>
  list.some((c) => c.id === conn.id) ? list.map((c) => (c.id === conn.id ? conn : c)) : [...list, conn];

export const duplicateConnection = (conn: MongoConnection): MongoConnection => ({
  ...conn,
  id: crypto.randomUUID(),
  name: `${displayName(conn)} (copia)`,
});

export const removeConnection = (list: MongoConnection[], id: string) => list.filter((c) => c.id !== id);

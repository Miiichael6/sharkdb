import type { MongoConnection } from "../domain/connection";
import type { ServerInfo } from "../domain/session";
import type { SshTunnelConfig } from "../domain/ssh";

/** Where saved connections are persisted (secrets included, wherever the adapter keeps them). */
export interface ConnectionStore {
  load(): Promise<MongoConnection[]>;
  save(connections: MongoConnection[]): Promise<void>;
}

/**
 * Opens and closes server sessions, keyed by connection id; `ssh` routes them through a tunnel.
 * `safeMode` is the session's read-only switch, enforced by the backend.
 */
export interface SessionGateway {
  test(uri: string, ssh: SshTunnelConfig | null): Promise<ServerInfo>;
  open(id: string, uri: string, ssh: SshTunnelConfig | null, safeMode: boolean): Promise<ServerInfo>;
  setSafeMode(id: string, enabled: boolean): Promise<void>;
  close(id: string): Promise<void>;
  /** Opens one apart from the sessions, for an operation; each call holds it until `closeDetached`. */
  openDetached(id: string, uri: string, ssh: SshTunnelConfig | null, safeMode: boolean): Promise<ServerInfo>;
  closeDetached(id: string): Promise<void>;
}

/** Lets the user choose a local file (certificates, private keys). Null when cancelled. */
export interface FilePicker {
  pick(title: string): Promise<string | null>;
}

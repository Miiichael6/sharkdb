import { newConnection, type MongoConnection } from "./connection";

type Stored = Partial<MongoConnection> & Pick<MongoConnection, "id">;

/**
 * Brings a connection saved by an older version up to the current shape: every field missing
 * from the file (SSH, TLS files, replica set...) takes its default value.
 */
export function migrateConnection(stored: Stored): MongoConnection {
  const defaults = newConnection();
  return {
    ...defaults,
    ...stored,
    ssh: { ...defaults.ssh, ...stored.ssh },
    tlsFiles: { ...defaults.tlsFiles, ...stored.tlsFiles },
  };
}

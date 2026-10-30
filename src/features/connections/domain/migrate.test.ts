import { describe, expect, it } from "vitest";
import { DEFAULT_CONNECT_TIMEOUT_MS } from "./advancedOptions";
import { buildUri } from "./connection";
import { migrateConnection } from "./migrate";

// Shape written to connections.json before SSH/TLS files/replica set existed.
const legacy = {
  id: "0f8fad5b-d9cb-469f-a165-70867728950e",
  name: "Legacy",
  driver: "mongodb" as const,
  tag: "production" as const,
  color: "#dc2626",
  mode: "fields" as const,
  uri: "",
  host: "db.local",
  port: 27018,
  srv: false,
  username: "ana",
  password: "pw",
  authDb: "admin",
  database: "",
  tls: true,
  options: "w=majority",
};

describe("migrateConnection", () => {
  it("keeps every saved field and fills the new ones with defaults", () => {
    const c = migrateConnection(legacy);
    expect(c).toMatchObject(legacy);
    expect(c.ssh.enabled).toBe(false);
    expect(c.tlsFiles).toEqual({ caFile: "", certificateKeyFile: "", allowInvalidCertificates: false });
    expect(c).toMatchObject({ replicaSet: "", readPreference: "primary", connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS });
  });

  it("builds the same URI as before the migration", () => {
    expect(buildUri(migrateConnection(legacy))).toBe("mongodb://ana:pw@db.local:27018/?authSource=admin&tls=true&w=majority");
  });

  it("completes partially saved nested settings", () => {
    const c = migrateConnection({ ...legacy, ssh: { enabled: true, host: "bastion" } as never });
    expect(c.ssh).toMatchObject({ enabled: true, host: "bastion", port: 22, auth: "password" });
  });
});

import { describe, expect, it } from "vitest";
import type { RestoreRequest } from "../../features/backup/domain/backupSpec";
import { newConnection, type MongoConnection } from "../../features/connections/domain/connection";
import { PROTECTED_TARGET, SAFE_MODE_TARGET } from "../../features/connections/domain/endpoints";
import type { Session } from "../../features/connections/domain/session";
import {
  CONNECTION_GONE,
  connectionChanged,
  dataRequest,
  isDataRequest,
  retryBlockReason,
  staleReason,
  TARGET_NOT_OPEN,
  usedConnections,
  writtenConnection,
} from "./dataRequest";

const conn = (id: string, change: Partial<MongoConnection> = {}): MongoConnection => ({
  ...newConnection(),
  id,
  host: `${id}.example`,
  ...change,
});
const session = (c: MongoConnection, safeMode = false): Session => ({ conn: c, safeMode, info: { version: "7", databases: [] } });

const QA = conn("qa", { tag: "testing" });
const LOCAL = conn("local", { tag: "local" });
const PROD = conn("prod", { tag: "production" });
const CONNECTIONS = [QA, LOCAL, PROD];

const DATABASES = [{ db: "shop", collections: ["orders"] }];
const SYNC = dataRequest({ type: "sync", request: { sourceSid: "qa", targetSid: "local", databases: DATABASES } }, CONNECTIONS);
const DOCUMENTS = dataRequest(
  { type: "documents", request: { sourceSid: "qa", targetSid: "local", db: "shop", collection: "orders", ids: [1] } },
  CONNECTIONS,
);
const BACKUP = dataRequest({ type: "backup", request: { sid: "qa", dir: "C:/bk", databases: DATABASES } }, CONNECTIONS);
const TO_PROD: RestoreRequest = { dir: "C:/bk", targetSid: "prod", databases: DATABASES };
const RESTORE = dataRequest({ type: "restore", request: TO_PROD }, CONNECTIONS);
const CONFIRMED = dataRequest({ type: "restore", request: { ...TO_PROD, confirmProtected: true } }, CONNECTIONS);

/** `CONNECTIONS` with `id` edited as `change`. */
const edited = (id: string, change: Partial<MongoConnection>) => CONNECTIONS.map((c) => (c.id === id ? { ...c, ...change } : c));

describe("dataRequest", () => {
  it("recognizes the stored requests, also once they crossed windows as JSON", () => {
    expect(isDataRequest(JSON.parse(JSON.stringify(SYNC)))).toBe(true);
    expect(isDataRequest({ type: "sync", request: {} })).toBe(false);
    expect(isDataRequest({ type: "drop", request: {}, fingerprints: {} })).toBe(false);
    expect(isDataRequest(undefined)).toBe(false);
  });

  it("tells which connections it uses and which one it writes to", () => {
    expect([SYNC, DOCUMENTS, BACKUP, RESTORE].map(usedConnections)).toEqual([["qa", "local"], ["qa", "local"], ["qa"], ["prod"]]);
    expect([SYNC, DOCUMENTS, BACKUP, RESTORE].map(writtenConnection)).toEqual(["local", "local", undefined, "prod"]);
  });

  it("goes only where it was confirmed: a connection edited to another server, environment or protection stops it", () => {
    expect(staleReason(SYNC, CONNECTIONS)).toBeUndefined();
    // A new name or color is the same place.
    expect(staleReason(SYNC, edited("local", { name: "Mi local", color: "#f00" }))).toBeUndefined();
    expect(staleReason(SYNC, edited("local", { host: "otro.example" }))).toBe(connectionChanged({ ...LOCAL, host: "otro.example" }));
    expect(staleReason(SYNC, edited("qa", { host: "otro.example" }))).toContain("cambió");
    expect(staleReason(SYNC, edited("local", { tag: "development" }))).toContain("cambió");
    expect(staleReason(SYNC, CONNECTIONS.filter((c) => c.id !== "local"))).toBe(CONNECTION_GONE);
    expect(retryBlockReason(SYNC, edited("local", { host: "otro.example" }), [session(LOCAL)])).toContain("cambió");
  });

  it("never takes a destination it couldn't open as writable", () => {
    expect(retryBlockReason(SYNC, CONNECTIONS, [])).toBe(TARGET_NOT_OPEN);
    expect(retryBlockReason(RESTORE, CONNECTIONS, [session(QA)])).toBe(TARGET_NOT_OPEN);
  });

  it("never writes to a destination that became protected or production, as registered now (R103)", () => {
    const nowProtected = edited("local", { protected: true });
    expect(retryBlockReason(SYNC, nowProtected, [session(LOCAL)])).toContain("cambió");
    // A second entry on the same server as a protected one: unchanged itself, still never written to.
    const twin = [...CONNECTIONS, conn("twin", { host: "local.example", protected: true })];
    expect(retryBlockReason(DOCUMENTS, twin, [session(LOCAL)])).toBe(PROTECTED_TARGET);
    expect(retryBlockReason(SYNC, CONNECTIONS, [session(LOCAL)])).toBeUndefined();
  });

  it("lets a production restore through only while it's the same destination whose name was typed", () => {
    expect(retryBlockReason(CONFIRMED, CONNECTIONS, [session(PROD)])).toBeUndefined();
    expect(retryBlockReason(RESTORE, CONNECTIONS, [session(PROD)])).toBe(PROTECTED_TARGET);
    expect(retryBlockReason(CONFIRMED, CONNECTIONS, [session(PROD, true)])).toBe(SAFE_MODE_TARGET);
    // Marked protected or pointed elsewhere after the name was typed: asks for it again.
    expect(retryBlockReason(CONFIRMED, edited("prod", { protected: true }), [session(PROD)])).toContain("cambió");
    expect(retryBlockReason(CONFIRMED, edited("prod", { host: "otro.example" }), [session(PROD)])).toContain("cambió");
  });

  it("has nothing to write for a backup, but still reads only from the connection confirmed", () => {
    expect(retryBlockReason(BACKUP, CONNECTIONS, [])).toBeUndefined();
    expect(retryBlockReason(BACKUP, edited("qa", { host: "otro.example" }), [])).toContain("cambió");
  });
});

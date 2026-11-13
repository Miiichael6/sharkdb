import { describe, expect, it } from "vitest";
import type { RestoreRequest } from "../../features/backup/domain/backupSpec";
import { newConnection, type MongoConnection } from "../../features/connections/domain/connection";
import { PROTECTED_TARGET, SAFE_MODE_TARGET } from "../../features/connections/domain/endpoints";
import type { Session } from "../../features/connections/domain/session";
import { isDataRequest, retryBlockReason, usedConnections, writtenConnection, type DataRequest } from "./dataRequest";

const conn = (id: string, change: Partial<MongoConnection> = {}): MongoConnection => ({
  ...newConnection(),
  id,
  host: `${id}.example`,
  ...change,
});
const session = (c: MongoConnection, safeMode = false): Session => ({ conn: c, safeMode, info: { version: "7", databases: [] } });

const DATABASES = [{ db: "shop", collections: ["orders"] }];
const SYNC: DataRequest = { type: "sync", request: { sourceSid: "qa", targetSid: "local", databases: DATABASES } };
const DOCUMENTS: DataRequest = {
  type: "documents",
  request: { sourceSid: "qa", targetSid: "local", db: "shop", collection: "orders", ids: [1] },
};
const BACKUP: DataRequest = { type: "backup", request: { sid: "qa", dir: "C:/bk", databases: DATABASES } };
const TO_PROD: RestoreRequest = { dir: "C:/bk", targetSid: "prod", databases: DATABASES };
const RESTORE: DataRequest = { type: "restore", request: TO_PROD };

describe("dataRequest", () => {
  it("recognizes the stored requests, also once they crossed windows as JSON", () => {
    expect(isDataRequest(JSON.parse(JSON.stringify(SYNC)))).toBe(true);
    expect(isDataRequest({ type: "drop", request: {} })).toBe(false);
    expect(isDataRequest(undefined)).toBe(false);
  });

  it("tells which connections it uses and which one it writes to", () => {
    expect([SYNC, DOCUMENTS, BACKUP, RESTORE].map(usedConnections)).toEqual([["qa", "local"], ["qa", "local"], ["qa"], ["prod"]]);
    expect([SYNC, DOCUMENTS, BACKUP, RESTORE].map(writtenConnection)).toEqual(["local", "local", undefined, "prod"]);
  });

  it("never writes to a destination that became protected or production, as registered now (R103)", () => {
    const local = conn("local");
    const nowProtected = [conn("local", { protected: true })];
    expect(retryBlockReason(SYNC, nowProtected, session(local))).toBe(PROTECTED_TARGET);
    expect(retryBlockReason(DOCUMENTS, [conn("local", { tag: "production" })], session(local))).toBe(PROTECTED_TARGET);
    expect(retryBlockReason(SYNC, [local], session(local))).toBeUndefined();
  });

  it("holds back a destination in safe mode, even a production restore confirmed by its name", () => {
    const prod = conn("prod", { tag: "production" });
    const confirmed: DataRequest = { type: "restore", request: { ...TO_PROD, confirmProtected: true } };
    expect(retryBlockReason(confirmed, [prod], session(prod))).toBeUndefined();
    expect(retryBlockReason(RESTORE, [prod], session(prod))).toBe(PROTECTED_TARGET);
    expect(retryBlockReason(confirmed, [prod], session(prod, true))).toBe(SAFE_MODE_TARGET);
  });

  it("has nothing to check for a backup, which doesn't write to a connection", () => {
    expect(retryBlockReason(BACKUP, [], undefined)).toBeUndefined();
  });
});

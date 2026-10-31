import { describe, expect, it } from "vitest";
import { newConnection } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import { INVALID_DB_NAME } from "../../explorer/domain/copySpec";
import {
  COLLECTIONS_REQUIRED,
  FOLDER_REQUIRED,
  PROTECTED_TARGET,
  SAFE_MODE_TARGET,
  TARGET_DB_REQUIRED,
  backupDir,
  backupSummary,
  folderName,
  progressPercent,
  restoreBlockReason,
  restoreSummary,
  validateBackup,
  validateRestore,
  type RestoreRequest,
} from "./backupSpec";

const session = (over: { protected?: boolean; safeMode?: boolean } = {}): Session => ({
  conn: { ...newConnection(), name: "local", protected: !!over.protected },
  info: { version: "7.0", databases: [] },
  safeMode: !!over.safeMode,
});

const restore = (over: Partial<RestoreRequest>): RestoreRequest => ({
  sid: "s1",
  db: "shop",
  dir: "C:\\backups\\shop",
  collections: ["orders"],
  dropBefore: false,
  ...over,
});

describe("backupSpec", () => {
  it("saves each database in its own folder, keeping the separator", () => {
    expect(backupDir("C:\\backups\\", "shop")).toBe("C:\\backups\\shop");
    expect(backupDir("/home/ana/backups", "shop")).toBe("/home/ana/backups/shop");
  });

  it("takes the restore database from the folder name", () => {
    expect(folderName("C:\\backups\\shop\\")).toBe("shop");
    expect(folderName("/tmp/dump/sales")).toBe("sales");
  });

  it("measures overall progress across collections", () => {
    expect(progressPercent({ index: 0, count: 2, done: 0, total: 0 })).toBe(0);
    expect(progressPercent({ index: 0, count: 2, done: 50, total: 100 })).toBe(25);
    expect(progressPercent({ index: 1, count: 2, done: 100, total: 100 })).toBe(100);
    expect(progressPercent({ index: 0, count: 1, done: 120, total: 100 })).toBe(100);
  });

  it("needs a folder and at least one collection", () => {
    const backup = { sid: "s1", db: "shop", collections: ["orders"], dir: " C:\\b\\shop " };
    expect(validateBackup(backup).dir).toBe("C:\\b\\shop");
    expect(() => validateBackup({ ...backup, dir: " " })).toThrow(FOLDER_REQUIRED);
    expect(() => validateBackup({ ...backup, collections: [] })).toThrow(COLLECTIONS_REQUIRED);
  });

  it("checks the restore destination database", () => {
    expect(validateRestore(restore({ db: " copy " })).db).toBe("copy");
    expect(() => validateRestore(restore({ db: "" }))).toThrow(TARGET_DB_REQUIRED);
    expect(() => validateRestore(restore({ db: "a.b" }))).toThrow(INVALID_DB_NAME);
    expect(() => validateRestore(restore({ collections: [] }))).toThrow(COLLECTIONS_REQUIRED);
  });

  it("never restores over protected or safe-mode sessions", () => {
    expect(restoreBlockReason(session())).toBeUndefined();
    expect(restoreBlockReason(session({ protected: true }))).toBe(PROTECTED_TARGET);
    expect(restoreBlockReason(session({ safeMode: true }))).toBe(SAFE_MODE_TARGET);
  });

  it("summarizes the results", () => {
    const results = [
      { collection: "a", documents: 3, duplicates: 0, indexes: 1 },
      { collection: "b", documents: 1, duplicates: 2, indexes: 0 },
    ];
    expect(backupSummary("shop", results)).toBe("Backup de shop: 2 colecciones, 4 documentos");
    expect(restoreSummary("shop", results)).toBe("Restaurado en shop: 2 colecciones, 4 documentos (2 saltados por _id repetido)");
    expect(restoreSummary("shop", results.slice(0, 1))).toBe("Restaurado en shop: 1 colección, 3 documentos");
  });
});

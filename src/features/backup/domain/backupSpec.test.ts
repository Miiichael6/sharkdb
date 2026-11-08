import { describe, expect, it } from "vitest";
import { MODIFY_HEADING } from "../../../shared/domain/confirmation";
import { COLLECTIONS_REQUIRED, type DatabaseCatalog } from "../../../shared/domain/selection";
import {
  FOLDER_REQUIRED,
  SOURCE_REQUIRED,
  TARGET_REQUIRED,
  backupConfirmation,
  backupDatabases,
  backupPlan,
  backupSummary,
  currentDatabases,
  currentSelection,
  PRODUCTION_RESTORE_HEADING,
  productionRestoreWarning,
  restoreConfirmation,
  restorePlan,
  restoreSummary,
  validateBackup,
  validateRestore,
  type BackupRequest,
  type RestoreRequest,
} from "./backupSpec";

const SHOP: DatabaseCatalog = { name: "shop", sizeOnDisk: 0, collections: ["orders", "users"] };
const LOG: DatabaseCatalog = { name: "log", sizeOnDisk: 0, collections: ["events"] };
const DATABASES = [{ db: "shop", collections: ["orders"] }];

const backup = (over: Partial<BackupRequest> = {}): BackupRequest => ({ sid: "s1", dir: " C:\\b ", databases: DATABASES, ...over });
const restore = (over: Partial<RestoreRequest> = {}): RestoreRequest => ({ dir: " C:\\b ", targetSid: "qa", databases: DATABASES, ...over });

describe("backupSpec", () => {
  it("remembers which databases were chosen whole", () => {
    const plan = backupPlan([SHOP, LOG], { shop: ["orders"], log: ["events"] });
    expect(backupDatabases(plan)).toEqual([
      { db: "shop", collections: ["orders"] },
      { db: "log", collections: ["events"], complete: true },
    ]);
  });

  it("saves whole databases as they are now and skips what no longer exists (error 47)", () => {
    const now: DatabaseCatalog[] = [{ ...SHOP, collections: ["users", "invoices"] }, LOG];
    const chosen = [
      { db: "shop", collections: ["orders", "users"] },
      { db: "log", collections: ["events"], complete: true },
      { db: "gone", collections: ["x"], complete: true },
    ];
    expect(currentDatabases(chosen, now)).toEqual({
      databases: [
        { db: "shop", collections: ["users"] },
        { db: "log", collections: ["events"], complete: true },
      ],
      missing: ["shop.orders", "gone"],
    });
    const grown: DatabaseCatalog[] = [{ ...LOG, collections: ["events", "audit"] }];
    expect(currentDatabases([{ db: "log", collections: ["events"], complete: true }], grown).databases).toEqual([
      { db: "log", collections: ["events", "audit"], complete: true },
    ]);
  });

  it("chooses again whole databases with every collection they have now", () => {
    const grown: DatabaseCatalog[] = [{ ...SHOP, collections: ["orders", "users", "invoices"] }];
    expect(currentSelection([{ db: "shop", collections: ["orders", "users"], complete: true }], grown)).toEqual({
      shop: ["orders", "users", "invoices"],
    });
    expect(currentSelection([{ db: "shop", collections: ["orders"] }], grown)).toEqual({ shop: ["orders"] });
  });

  it("needs a source, a folder and at least one collection to back up", () => {
    expect(validateBackup(backup()).dir).toBe("C:\\b");
    expect(() => validateBackup(backup({ sid: "" }))).toThrow(SOURCE_REQUIRED);
    expect(() => validateBackup(backup({ dir: " " }))).toThrow(FOLDER_REQUIRED);
    expect(() => validateBackup(backup({ databases: [] }))).toThrow(COLLECTIONS_REQUIRED);
  });

  it("needs a folder, a destination and at least one collection to restore", () => {
    expect(validateRestore(restore()).dir).toBe("C:\\b");
    expect(() => validateRestore(restore({ dir: "" }))).toThrow(FOLDER_REQUIRED);
    expect(() => validateRestore(restore({ targetSid: "" }))).toThrow(TARGET_REQUIRED);
    expect(() => validateRestore(restore({ databases: [{ db: "shop", collections: [] }] }))).toThrow(COLLECTIONS_REQUIRED);
  });

  it("asks to confirm saving to the folder", () => {
    const plan = backupPlan([LOG, SHOP], { shop: ["orders"] });
    const confirm = backupConfirmation(plan, "QA", "C:\\b");
    expect(confirm.heading).toBe("Se va a GUARDAR en");
    expect(confirm.target).toEqual({ name: "C:\\b" });
    expect(confirm.items).toEqual([
      { badge: "guarda", kind: "save", name: "shop", detail: "parcial · 1 colección", collections: ["orders"] },
    ]);
  });

  it("asks to confirm modifying the destination, replacing the databases it has", () => {
    const plan = restorePlan([LOG, SHOP], { shop: SHOP.collections, log: ["events"] }, ["shop"]);
    const confirm = restoreConfirmation(plan, "C:\\b", { name: "local", tag: "local" }, "ocupada");
    expect(confirm.heading ?? MODIFY_HEADING).toBe(MODIFY_HEADING);
    expect(confirm.items.map((i) => [i.name, i.badge])).toEqual([
      ["log", "nueva"],
      ["shop", "reemplaza"],
    ]);
    expect(confirm.blocked).toBe("ocupada");
    expect(confirm.warning).toBeUndefined();
    expect(confirm.confirmWord).toBeUndefined();
  });

  it("restoring into production warns and asks for the connection's name", () => {
    const plan = restorePlan([SHOP], { shop: SHOP.collections }, ["shop"]);
    const confirm = restoreConfirmation(plan, "C:\b", { name: "SIGO prod", tag: "production" }, undefined, true);
    expect(confirm.heading).toBe(PRODUCTION_RESTORE_HEADING);
    expect(confirm.warning).toBe(productionRestoreWarning("SIGO prod"));
    expect(confirm.confirmWord).toBe("SIGO prod");
    expect(confirm.confirmLabel).toBe("Restaurar en producción");
  });

  it("summarizes the results", () => {
    const results = [
      { collection: "shop.a", documents: 3, duplicates: 0, indexes: 1 },
      { collection: "log.b", documents: 1, duplicates: 0, indexes: 0 },
    ];
    expect(backupSummary("C:\\b", 2, results)).toBe("Backup en b: 2 bases de datos, 2 colecciones, 4 documentos");
    expect(restoreSummary("local", 1, results.slice(0, 1))).toBe("Restaurado en local: 1 base de datos, 1 colección, 3 documentos");
  });
});

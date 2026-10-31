import { describe, expect, it } from "vitest";
import { MODIFY_HEADING } from "../../../shared/domain/confirmation";
import { COLLECTIONS_REQUIRED, type DatabaseCatalog } from "../../../shared/domain/selection";
import {
  FOLDER_REQUIRED,
  SOURCE_REQUIRED,
  TARGET_REQUIRED,
  backupConfirmation,
  backupPlan,
  backupSummary,
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
    expect(confirm.items).toEqual([{ badge: "guarda", kind: "save", name: "shop", detail: "orders" }]);
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

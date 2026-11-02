import { describe, expect, it } from "vitest";
import { replacePlan } from "../../../shared/domain/databasePlan";
import { COLLECTIONS_REQUIRED, type DatabaseCatalog } from "../../../shared/domain/selection";
import {
  TARGET_IS_SOURCE,
  TARGET_REQUIRED,
  syncConfirmation,
  syncRequest,
  syncSummary,
  validateSync,
  type SyncRequest,
} from "./syncPlan";

const SHOP: DatabaseCatalog = { name: "shop", sizeOnDisk: 0, collections: ["orders", "users", "carts"] };
const LOG: DatabaseCatalog = { name: "log", sizeOnDisk: 0, collections: ["events"] };
const PLAN = replacePlan([LOG, SHOP], { shop: ["orders"], log: ["events"] }, ["shop"]);

const request = (over: Partial<SyncRequest> = {}): SyncRequest => ({
  sourceSid: "prod",
  targetSid: "qa",
  databases: [{ db: "shop", collections: ["orders"] }],
  ...over,
});

describe("syncPlan", () => {
  it("builds the request from the plan", () => {
    expect(syncRequest("prod", "qa", PLAN)).toEqual(
      request({ databases: [{ db: "log", collections: ["events"] }, { db: "shop", collections: ["orders"] }] }),
    );
  });

  it("validates the request", () => {
    expect(validateSync(request())).toEqual(request());
    expect(() => validateSync(request({ targetSid: "" }))).toThrow(TARGET_REQUIRED);
    expect(() => validateSync(request({ targetSid: "prod" }))).toThrow(TARGET_IS_SOURCE);
    expect(() => validateSync(request({ databases: [] }))).toThrow(COLLECTIONS_REQUIRED);
  });

  it("describes what the destination loses for the confirmation window", () => {
    const confirm = syncConfirmation(PLAN, "QA", { name: "local", tag: "local" });
    expect(confirm.target).toEqual({ name: "local", tag: "local" });
    expect(confirm.heading).toBeUndefined();
    expect(confirm.items).toEqual([
      { badge: "nueva", kind: "create", name: "log", detail: "completa · 1 colección", collections: ["events"] },
      { badge: "reemplaza", kind: "replace", name: "shop", detail: "parcial · 1 colección", collections: ["orders"] },
    ]);
    expect(confirm.blocked).toBeUndefined();
  });

  it("summarizes the result", () => {
    const results = [{ collection: "shop.orders", documents: 1200, duplicates: 0, indexes: 2 }];
    expect(syncSummary("QA", 1, results)).toBe(`Sincronizado QA: 1 base de datos, 1 colección, ${(1200).toLocaleString()} documentos`);
  });
});

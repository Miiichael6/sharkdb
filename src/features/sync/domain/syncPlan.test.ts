import { describe, expect, it } from "vitest";
import { COLLECTIONS_REQUIRED, SAFE_MODE_TARGET } from "../../backup/domain/backupSpec";
import { newConnection, type Tag } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import {
  TARGET_IS_SOURCE,
  TARGET_REQUIRED,
  confirmationMatches,
  databaseState,
  filterCollections,
  originSelection,
  planLabel,
  selectEverything,
  syncPlan,
  syncRequest,
  syncSources,
  syncSummary,
  syncTargets,
  toggleCollection,
  toggleDatabase,
  validateSync,
  type DatabaseCatalog,
  type SyncRequest,
} from "./syncPlan";

const SHOP: DatabaseCatalog = { name: "shop", sizeOnDisk: 0, collections: ["orders", "users", "carts"] };
const LOG: DatabaseCatalog = { name: "log", sizeOnDisk: 0, collections: ["events"] };
const EMPTY: DatabaseCatalog = { name: "empty", sizeOnDisk: 0, collections: [] };
const CATALOG = [LOG, SHOP, EMPTY];

const request = (over: Partial<SyncRequest> = {}): SyncRequest => ({
  sourceSid: "prod",
  targetSid: "qa",
  databases: [{ db: "shop", collections: ["orders"] }],
  ...over,
});

const session = (id: string, over: { protected?: boolean; safeMode?: boolean; tag?: Tag } = {}): Session => ({
  conn: { ...newConnection(), id, name: id, protected: !!over.protected, tag: over.tag ?? "development" },
  info: { version: "7.0", databases: [] },
  safeMode: !!over.safeMode,
});

describe("syncPlan", () => {
  it("checks a whole database or clears it", () => {
    const whole = toggleDatabase({}, SHOP);
    expect(whole).toEqual({ shop: ["orders", "users", "carts"] });
    expect(databaseState(whole, SHOP)).toBe("complete");
    expect(toggleDatabase(whole, SHOP)).toEqual({});
    // A partly chosen database becomes complete.
    expect(toggleDatabase({ shop: ["users"] }, SHOP)).toEqual(whole);
  });

  it("chooses single collections in the source's order", () => {
    let selection = toggleCollection({}, SHOP, "carts");
    selection = toggleCollection(selection, SHOP, "orders");
    expect(selection).toEqual({ shop: ["orders", "carts"] });
    expect(databaseState(selection, SHOP)).toBe("partial");
    expect(databaseState(selection, LOG)).toBe("none");
    expect(toggleCollection(toggleCollection(selection, SHOP, "orders"), SHOP, "carts")).toEqual({});
  });

  it("chooses every database whole, skipping empty ones", () => {
    expect(selectEverything(CATALOG)).toEqual({ log: ["events"], shop: ["orders", "users", "carts"] });
  });

  it("starts with what the window was opened on", () => {
    expect(originSelection(CATALOG, "shop", "users")).toEqual({ shop: ["users"] });
    expect(originSelection(CATALOG, "shop")).toEqual({ shop: SHOP.collections });
    expect(originSelection(CATALOG, "missing")).toEqual({});
    expect(originSelection(CATALOG)).toEqual({});
  });

  it("filters collections by name, ignoring case", () => {
    expect(filterCollections(SHOP.collections, " US ")).toEqual(["users"]);
    expect(filterCollections(SHOP.collections, "")).toEqual(SHOP.collections);
  });

  it("plans each database: replaced when the destination has it, otherwise created", () => {
    const plan = syncPlan(CATALOG, { shop: ["orders"], log: ["events"] }, ["shop"]);
    expect(plan).toEqual([
      { db: "log", collections: ["events"], complete: true, action: "create" },
      { db: "shop", collections: ["orders"], complete: false, action: "replace" },
    ]);
    expect(planLabel(plan)).toBe("2 bases de datos · 2 colecciones");
    expect(syncRequest("prod", "qa", plan)).toEqual(
      request({ databases: [{ db: "log", collections: ["events"] }, { db: "shop", collections: ["orders"] }] }),
    );
  });

  it("validates the request", () => {
    expect(validateSync(request())).toEqual(request());
    expect(() => validateSync(request({ targetSid: "" }))).toThrow(TARGET_REQUIRED);
    expect(() => validateSync(request({ targetSid: "prod" }))).toThrow(TARGET_IS_SOURCE);
    expect(() => validateSync(request({ databases: [] }))).toThrow(COLLECTIONS_REQUIRED);
  });

  it("never offers a protected or production connection as destination", () => {
    const sessions = [
      session("prod", { protected: true }),
      session("prod2", { tag: "production" }),
      session("qa"),
      session("ro", { safeMode: true }),
    ];
    expect(syncTargets(sessions).map((t) => [t.sid, t.blocked])).toEqual([
      ["qa", undefined],
      ["ro", SAFE_MODE_TARGET],
    ]);
    expect(syncSources(sessions).map((s) => s.sid)).toEqual(["prod", "prod2", "qa", "ro"]);
  });

  it("asks to type the destination connection's name", () => {
    expect(confirmationMatches(" QA ", "QA")).toBe(true);
    expect(confirmationMatches("QA2", "QA")).toBe(false);
    expect(confirmationMatches("", "")).toBe(false);
  });

  it("summarizes the result", () => {
    const results = [{ collection: "shop.orders", documents: 1200, duplicates: 0, indexes: 2 }];
    expect(syncSummary("QA", 1, results)).toBe(
      `Sincronizado QA: 1 base de datos, 1 colección, ${(1200).toLocaleString()} documentos`,
    );
  });
});

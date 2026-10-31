import { describe, expect, it } from "vitest";
import { COLLECTIONS_REQUIRED, SAFE_MODE_TARGET } from "../../backup/domain/backupSpec";
import { newConnection, type MongoConnection, type Tag } from "../../connections/domain/connection";
import type { Session } from "../../connections/domain/session";
import {
  TARGET_IS_SOURCE,
  TARGET_REQUIRED,
  databaseState,
  filterCollections,
  originSelection,
  pickTarget,
  planLabel,
  requestSelection,
  selectEverything,
  syncConfirmation,
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

const connection = (id: string, over: { protected?: boolean; tag?: Tag } = {}): MongoConnection => ({
  ...newConnection(),
  id,
  name: id,
  protected: !!over.protected,
  tag: over.tag ?? "development",
});

const session = (conn: MongoConnection, safeMode = false): Session => ({
  conn,
  info: { version: "7.0", databases: [] },
  safeMode,
});

const PROD = connection("prod", { protected: true });
const PROD2 = connection("prod2", { tag: "production" });
const QA = connection("qa");
const LOCAL = connection("local", { tag: "local" });
const RO = connection("ro");
const CONNECTIONS = [PROD, PROD2, QA, LOCAL, RO];
const ids = (options: { id: string }[]) => options.map((o) => o.id);

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

  it("offers closed connections as destination, never a protected or production one", () => {
    const sessions = [session(PROD), session(QA), session(RO, true)];
    const targets = syncTargets(CONNECTIONS, sessions, "prod");
    expect(targets.map((t) => [t.id, t.connected, t.blocked])).toEqual([
      ["qa", true, undefined],
      ["local", false, undefined],
      ["ro", true, SAFE_MODE_TARGET],
    ]);
    // Closed or open, production never appears.
    expect(ids(syncTargets(CONNECTIONS, [], "qa"))).toEqual(["local", "ro"]);
  });

  it("offers every registered connection as source, open or closed", () => {
    expect(syncSources(CONNECTIONS, [session(PROD)]).map((s) => [s.id, s.connected])).toEqual([
      ["prod", true],
      ["prod2", false],
      ["qa", false],
      ["local", false],
      ["ro", false],
    ]);
  });

  it("never offers the same connection at both ends", () => {
    expect(ids(syncTargets(CONNECTIONS, [], "qa"))).not.toContain("qa");
    expect(ids(syncSources(CONNECTIONS, [], "local"))).not.toContain("local");
  });

  it("moves the destination when it becomes the source", () => {
    // "local" was the destination; choosing it as source takes it out of the destinations.
    const targets = syncTargets(CONNECTIONS, [session(RO, true)], "local");
    expect(pickTarget(targets, "local")).toBe("qa");
    expect(pickTarget(targets, "qa")).toBe("qa");
    // Only a blocked one is left: no destination.
    expect(pickTarget(syncTargets([QA, RO], [session(RO, true)], "qa"), "qa")).toBe("");
    expect(pickTarget([], "qa")).toBe("");
  });

  it("chooses again what a request had, to go back to the selection", () => {
    expect(requestSelection(request({ databases: [{ db: "shop", collections: ["orders"] }, { db: "log", collections: [] }] }))).toEqual({
      shop: ["orders"],
    });
  });

  it("describes what the destination loses for the confirmation window", () => {
    const plan = syncPlan(CATALOG, { shop: ["orders"], log: ["events"] }, ["shop"]);
    const confirm = syncConfirmation(plan, "QA", { name: "local", tag: "local" });
    expect(confirm.target).toEqual({ name: "local", tag: "local" });
    expect(confirm.items).toEqual([
      { badge: "nueva", kind: "create", name: "log", detail: "completa · 1 colección" },
      { badge: "reemplaza", kind: "replace", name: "shop", detail: "orders" },
    ]);
    expect(confirm.blocked).toBeUndefined();
  });

  it("summarizes the result", () => {
    const results = [{ collection: "shop.orders", documents: 1200, duplicates: 0, indexes: 2 }];
    expect(syncSummary("QA", 1, results)).toBe(
      `Sincronizado QA: 1 base de datos, 1 colección, ${(1200).toLocaleString()} documentos`,
    );
  });
});

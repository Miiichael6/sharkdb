import { describe, expect, it } from "vitest";
import {
  applyCollectionEvent,
  byDatabase,
  collectionDescription,
  collectionDuplicates,
  collectionPercent,
  collectionPhase,
  collectionStatusLabel,
  copySummaryLabel,
  databaseSummary,
  databaseSummaryLabel,
  inPhase,
  isPartiallyApplied,
  opensByDefault,
  plannedCollections,
  settleCollections,
  type CollectionUpdate,
  type ReportedCollectionState,
  usesStaging,
} from "./collectionProgress";

const PLAN = plannedCollections([
  { db: "shop", collections: ["orders", "users"] },
  { db: "logs", collections: ["events"] },
]);

const update = (collection: string, state: ReportedCollectionState, done = 0, total = 10, db = "shop"): CollectionUpdate => ({
  job: "j",
  db,
  collection,
  state,
  done,
  total,
});

const apply = (...updates: CollectionUpdate[]) => updates.reduce(applyCollectionEvent, PLAN);
const statuses = (list: ReturnType<typeof apply>) => list.map((e) => `${e.db}.${e.collection}:${e.status}`);

describe("collection progress", () => {
  it("starts with every chosen collection waiting, in the order of the plan", () => {
    expect(statuses(PLAN)).toEqual(["shop.orders:pending", "shop.users:pending", "logs.events:pending"]);
    expect(PLAN.every((e) => collectionPercent(e) === 0)).toBe(true);
  });

  it("follows each collection on its own, several at once", () => {
    const list = apply(update("orders", "running", 5), update("users", "running", 1, 4), update("events", "running", 0, 0, "logs"));
    expect(list.map(collectionPercent)).toEqual([50, 25, 0]);
    expect(statuses(list)).toEqual(["shop.orders:running", "shop.users:running", "logs.events:running"]);
  });

  it("a copied collection is whole; a late event never takes one back", () => {
    const list = apply(update("orders", "copied", 10, 10), update("orders", "running", 3), update("users", "failed", 2));
    expect(list[0]).toMatchObject({ status: "copied", done: 10 });
    expect(collectionPercent(list[0])).toBe(100);
    expect(apply(update("users", "applied", 10, 10), update("users", "copied", 10, 10))[1].status).toBe("applied");
  });

  it("keeps the error of the collection that failed", () => {
    const failed = { ...update("users", "failed", 2), error: "boom" };
    expect(apply(failed)[1]).toMatchObject({ status: "failed", error: "boom", done: 2 });
  });

  it("adds a collection the plan didn't have", () => {
    expect(statuses(apply(update("extra", "running")))).toContain("shop.extra:running");
  });

  it("cancelled or failed: what wasn't applied is discarded, the one that failed stays failed", () => {
    const list = apply(update("orders", "copied", 10, 10), update("users", "failed", 2));
    expect(statuses(settleCollections(list, "cancelled"))).toEqual([
      "shop.orders:discarded",
      "shop.users:failed",
      "logs.events:discarded",
    ]);
    const partly = apply(update("orders", "applied", 10, 10));
    expect(settleCollections(partly, "failed")[0].status).toBe("applied");
  });

  it("done: every collection ends applied at full", () => {
    const settled = settleCollections(apply(update("orders", "copied", 12, 10)), "done");
    expect(settled.every((e) => e.status === "applied" && collectionPercent(e) === 100)).toBe(true);
    expect(settled[0]).toMatchObject({ done: 12, total: 12 });
  });

  it("groups by database with a summary whose header shows the state that matters most", () => {
    const list = apply(update("orders", "applied", 10, 10), update("users", "running", 5), update("events", "copied", 4, 4, "logs"));
    const groups = byDatabase(list);
    expect(groups.map((g) => [g.db, g.collections.length])).toEqual([["shop", 2], ["logs", 1]]);
    expect(databaseSummary(groups[0])).toEqual({ applied: 1, total: 2, percent: 75, worst: "running" });
    expect(databaseSummary(groups[1])).toEqual({ applied: 0, total: 1, percent: 100, worst: "copied" });
    const failed = byDatabase(apply(update("users", "failed"), update("orders", "running")))[0];
    expect(databaseSummary(failed).worst).toBe("failed");
    expect(databaseSummary(byDatabase(settleCollections(PLAN, "done"))[0]).worst).toBe("applied");
  });

  it("a restore with duplicates stays applied; the warning comes from its result", () => {
    const [orders] = settleCollections(apply(update("orders", "applied", 10, 10)), "done");
    const results = [{ collection: "shop.orders", documents: 7, duplicates: 3, indexes: 1 }];
    expect(orders.status).toBe("applied");
    expect(collectionDuplicates(orders, results)).toBe(3);
    expect(collectionDuplicates(PLAN[1], results)).toBe(0);
  });
});

describe("collection status in words", () => {
  const entry = (status: ReturnType<typeof apply>[number]["status"], done = 0, error?: string) => ({
    db: "shop",
    collection: "orders",
    status,
    done,
    total: 10,
    ...(error ? { error } : {}),
  });

  it("calls a finished collection Guardada in a backup and Aplicada elsewhere", () => {
    expect(collectionStatusLabel("applied", "backup")).toBe("Guardada");
    expect(collectionStatusLabel("applied", "sync")).toBe("Aplicada");
    expect(collectionStatusLabel("copied", "restore")).toBe("Copiada, se aplica al final");
  });

  it("says the state, the percentage, the error and the duplicates, not only the colour", () => {
    expect(collectionDescription(entry("running", 4), "sync")).toBe("orders · En curso · 40 %");
    expect(collectionDescription(entry("failed", 2, "disk full"), "restore")).toBe("orders · Error: disk full · 20 %");
    expect(collectionDescription(entry("applied", 10), "restore", 3)).toBe("orders · Aplicada · 100 % · ⚠ 3 duplicados");
    expect(collectionDescription(entry("discarded", 5), "sync")).toBe("orders · Descartada · 50 %");
  });

  it("sums a database up and opens the one in course, with an error or alone", () => {
    const summary = { applied: 12, total: 20, percent: 64, worst: "running" as const };
    expect(databaseSummaryLabel(summary)).toBe("12/20 · 64 %");
    expect(opensByDefault(summary, 3)).toBe(true);
    expect(opensByDefault({ ...summary, worst: "failed" }, 3)).toBe(true);
    expect(opensByDefault({ ...summary, worst: "applied" }, 3)).toBe(false);
    expect(opensByDefault({ ...summary, worst: "pending" }, 3)).toBe(false);
    expect(opensByDefault({ ...summary, worst: "applied" }, 1)).toBe(true);
  });
});

describe("staging phases", () => {
  const phases = (list: ReturnType<typeof apply>) => list.map((e) => `${e.collection}:${collectionPhase(e)}`);

  it("only sync and restore copy through staging collections", () => {
    expect(["sync", "restore", "backup"].map((k) => usesStaging(k as "sync"))).toEqual([true, true, false]);
  });

  it("moves a collection to the replacement phase once it is copied", () => {
    const list = apply(update("orders", "running", 4), update("users", "copied", 10));
    expect(phases(list)).toEqual(["orders:copy", "users:replace", "events:copy"]);
    expect(inPhase(list, "replace").map((e) => e.collection)).toEqual(["users"]);
  });

  it("keeps a copied collection in the replacement phase when it is applied, fails or is discarded", () => {
    const list = apply(update("orders", "copied", 10), update("orders", "failed", 10), update("users", "copied", 10));
    expect(phases(settleCollections(list, "cancelled"))).toEqual(["orders:replace", "users:replace", "events:copy"]);
    expect(phases(settleCollections(list, "done"))).toEqual(["orders:replace", "users:replace", "events:replace"]);
  });

  it("labels a database while copying without a finished count", () => {
    expect(copySummaryLabel({ applied: 0, total: 3, percent: 40, worst: "running" })).toBe("3 · 40 %");
  });
});

describe("settling a backup that didn't end well", () => {
  it("discards even what was saved: an incomplete backup can't be restored", () => {
    const list = apply(update("orders", "applied", 10), update("users", "failed", 3));
    expect(statuses(settleCollections(list, "cancelled", "backup"))).toEqual([
      "shop.orders:discarded",
      "shop.users:failed",
      "logs.events:discarded",
    ]);
    expect(statuses(settleCollections(list, "cancelled", "sync"))[0]).toBe("shop.orders:applied");
  });
});

describe("a document sync cancelled halfway", () => {
  const halfway = apply(update("orders", "running", 2, 10), update("orders", "applied", 3, 10));

  it("keeps the documents written as applied, with how far it got, once the operation is cancelled", () => {
    const [orders, users] = settleCollections(halfway, "cancelled", "sync");
    expect(orders).toMatchObject({ status: "applied", done: 3, total: 10 });
    expect(isPartiallyApplied(orders)).toBe(true);
    expect(collectionPercent(orders)).toBe(30);
    expect(users.status).toBe("discarded");
  });

  it("says it in words: 3 de 10, applied in part", () => {
    const [orders] = halfway;
    expect(collectionStatusLabel("applied", "sync", true)).toBe("Aplicada en parte");
    expect(collectionDescription(orders, "sync")).toBe("orders · Aplicada en parte · 3 de 10");
  });

  it("an applied collection that is whole stays whole", () => {
    const [orders] = apply(update("orders", "applied", 10, 10));
    expect(isPartiallyApplied(orders)).toBe(false);
    expect(collectionPercent(orders)).toBe(100);
  });
});

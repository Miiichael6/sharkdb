import { describe, expect, it } from "vitest";
import {
  applyCollectionEvent,
  byDatabase,
  collectionDuplicates,
  collectionPercent,
  databaseSummary,
  plannedCollections,
  settleCollections,
  type CollectionUpdate,
  type ReportedCollectionState,
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

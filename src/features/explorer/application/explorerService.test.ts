import { describe, expect, it } from "vitest";
import { TARGET_IS_SOURCE, type CollectionRef, type CopyProgress } from "../domain/copySpec";
import type { Doc, IndexSpec } from "../domain/mongo";
import { createExplorerService } from "./explorerService";
import type { CollectionCopier, MongoAdmin } from "./ports";

const SOURCE = { sid: "s1", db: "shop", coll: "orders" };
const INDEXES: IndexSpec[] = [
  { v: 2, name: "_id_", key: { _id: 1 } },
  { v: 2, name: "email_1", key: { email: 1 }, unique: true },
];

/** Admin that records the calls the copy makes; anything else is not expected. */
function fakeAdmin(targetCount = 7) {
  const calls: unknown[][] = [];
  const admin = {
    runPipeline: async (sid: string, db: string, coll: string, pipeline: Doc[]) => {
      calls.push(["runPipeline", sid, db, coll, pipeline]);
    },
    collStats: async (sid: string, db: string, coll: string) => (calls.push(["collStats", sid, db, coll]), { count: targetCount }),
    listIndexes: async () => INDEXES,
    createIndex: async (sid: string, db: string, coll: string, spec: IndexSpec) => {
      calls.push(["createIndex", sid, db, coll, spec.name]);
    },
  } as unknown as MongoAdmin;
  return { admin, calls };
}

function fakeCopier(progress: CopyProgress[]) {
  const copies: [CollectionRef, CollectionRef][] = [];
  const copier: CollectionCopier = {
    copy: async (source, target, onProgress) => {
      copies.push([source, target]);
      progress.forEach(onProgress);
      return progress[progress.length - 1]?.copied ?? 0;
    },
  };
  return { copier, copies };
}

describe("explorerService.copyCollection", () => {
  it("copies on the same server with $out and counts the target", async () => {
    const { admin, calls } = fakeAdmin();
    const { copier, copies } = fakeCopier([]);
    const target = { sid: "s1", db: "archive", coll: "orders" };
    const copied = await createExplorerService(admin, copier).copyCollection(
      { source: SOURCE, target, copyIndexes: false },
      () => {},
    );
    expect(copied).toBe(7);
    expect(copies).toEqual([]);
    expect(calls).toEqual([
      ["runPipeline", "s1", "shop", "orders", [{ $match: {} }, { $out: { db: "archive", coll: "orders" } }]],
      ["collStats", "s1", "archive", "orders"],
    ]);
  });

  it("copies between connections through the copier, reporting its progress, and recreates indexes", async () => {
    const { admin, calls } = fakeAdmin();
    const steps = [
      { copied: 1000, total: 1500 },
      { copied: 1500, total: 1500 },
    ];
    const { copier, copies } = fakeCopier(steps);
    const target = { sid: "s2", db: "shop", coll: "orders" };
    const seen: CopyProgress[] = [];
    const copied = await createExplorerService(admin, copier).copyCollection(
      { source: SOURCE, target, copyIndexes: true },
      (p) => seen.push(p),
    );
    expect(copied).toBe(1500);
    expect(copies).toEqual([[SOURCE, target]]);
    expect(seen).toEqual(steps);
    expect(calls).toEqual([["createIndex", "s2", "shop", "orders", "email_1"]]);
  });

  it("rejects an invalid destination before touching the server", async () => {
    const { admin, calls } = fakeAdmin();
    const service = createExplorerService(admin, fakeCopier([]).copier);
    await expect(service.copyCollection({ source: SOURCE, target: SOURCE, copyIndexes: false }, () => {})).rejects.toBe(
      TARGET_IS_SOURCE,
    );
    expect(calls).toEqual([]);
  });
});

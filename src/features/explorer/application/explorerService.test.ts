import { describe, expect, it } from "vitest";
import { TARGET_EXISTS, TARGET_IS_SOURCE } from "../domain/copySpec";
import type { DatabaseEntry, Doc, IndexSpec } from "../domain/mongo";
import { serverNode } from "../domain/tree";
import { createExplorerService } from "./explorerService";
import type { MongoAdmin } from "./ports";

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
    listCollections: async () => [{ name: "orders" }, { name: "orders_old" }],
    createIndex: async (sid: string, db: string, coll: string, spec: IndexSpec) => {
      calls.push(["createIndex", sid, db, coll, spec.name]);
    },
  } as unknown as MongoAdmin;
  return { admin, calls };
}

describe("explorerService.copyCollection", () => {
  it("copies with $out on the source's server and counts the target", async () => {
    const { admin, calls } = fakeAdmin();
    const copied = await createExplorerService(admin).copyCollection({
      source: SOURCE,
      target: { db: "archive", coll: "orders" },
      copyIndexes: false,
    });
    expect(copied).toBe(7);
    expect(calls).toEqual([
      ["runPipeline", "s1", "shop", "orders", [{ $match: {} }, { $out: { db: "archive", coll: "orders" } }]],
      ["collStats", "s1", "archive", "orders"],
    ]);
  });

  it("recreates the indexes on the target when asked", async () => {
    const { admin, calls } = fakeAdmin();
    await createExplorerService(admin).copyCollection({
      source: SOURCE,
      target: { db: "archive", coll: "orders" },
      copyIndexes: true,
    });
    expect(calls.slice(2)).toEqual([["createIndex", "s1", "archive", "orders", "email_1"]]);
  });

  it("rejects an invalid destination before touching the server", async () => {
    const { admin, calls } = fakeAdmin();
    const service = createExplorerService(admin);
    await expect(service.copyCollection({ source: SOURCE, target: SOURCE, copyIndexes: false })).rejects.toBe(
      TARGET_IS_SOURCE,
    );
    expect(calls).toEqual([]);
  });
});

describe("explorerService.duplicateCollection", () => {
  it("copies into the same database with the indexes", async () => {
    const { admin, calls } = fakeAdmin();
    const copied = await createExplorerService(admin).duplicateCollection(SOURCE, " orders_copy ");
    expect(copied).toBe(7);
    expect(calls).toEqual([
      ["runPipeline", "s1", "shop", "orders", [{ $match: {} }, { $out: "orders_copy" }]],
      ["collStats", "s1", "shop", "orders_copy"],
      ["createIndex", "s1", "shop", "orders_copy", "email_1"],
    ]);
  });

  it("never replaces an existing collection", async () => {
    const { admin, calls } = fakeAdmin();
    await expect(createExplorerService(admin).duplicateCollection(SOURCE, "orders_old")).rejects.toBe(TARGET_EXISTS);
    expect(calls).toEqual([]);
  });

  it("rejects duplicating onto itself", async () => {
    const { admin } = fakeAdmin();
    await expect(createExplorerService(admin).duplicateCollection(SOURCE, "orders")).rejects.toBe(TARGET_IS_SOURCE);
  });
});

describe("explorerService.loadChildren of a connection", () => {
  const SERVER_DBS: DatabaseEntry[] = ["admin", "crm", "logs", "shop"].map((name) => ({ name, sizeOnDisk: 1, empty: false }));
  const service = () => createExplorerService({ listDatabases: async () => SERVER_DBS } as unknown as MongoAdmin);
  const labels = async (s: ReturnType<typeof service>) => (await s.loadChildren(serverNode("s1", "Local"))).map((n) => n.label);

  it("shows only the favorites and the temporary databases, and always the System folder", async () => {
    const s = service();
    s.setFavorites("s1", ["shop"]);
    s.openTemporary("s1", ["crm"]);
    expect(await labels(s)).toEqual(["System", "crm", "shop"]);
  });

  it("shows only the System folder until something is chosen", async () => {
    const s = service();
    expect(s.hasPinned("s1")).toBe(false);
    expect(await labels(s)).toEqual(["System"]);
    s.openTemporary("s1", ["logs"]);
    expect(s.hasPinned("s1")).toBe(true);
  });

  it("doesn't count a system database as chosen", () => {
    const s = service();
    s.setFavorites("s1", ["admin"]);
    s.openTemporary("s1", ["local"]);
    expect(s.hasPinned("s1")).toBe(false);
  });

  it("forgets a temporary database removed from the list, per connection", async () => {
    const s = service();
    s.openTemporary("s1", ["crm", "logs"]);
    s.openTemporary("s2", ["crm"]);
    s.forgetTemporary("s1", "crm");
    expect(await labels(s)).toEqual(["System", "logs"]);
    expect(s.temporariesOf("s2")).toEqual(["crm"]);
  });

  it("keeps system databases in their folder", async () => {
    const s = service();
    s.setFavorites("s1", ["admin", "shop"]);
    expect(await labels(s)).toEqual(["System", "shop"]);
  });
});

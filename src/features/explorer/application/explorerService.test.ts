import { describe, expect, it } from "vitest";
import { TARGET_EXISTS, TARGET_IS_SOURCE, TIMESERIES_TARGET_EXISTS } from "../domain/copySpec";
import type { DatabaseEntry, Doc, IndexSpec } from "../domain/mongo";
import { serverNode } from "../domain/tree";
import { createExplorerService } from "./explorerService";
import type { MongoAdmin } from "./ports";

const SOURCE = { sid: "s1", db: "shop", coll: "orders" };
const INDEXES: IndexSpec[] = [
  { v: 2, name: "_id_", key: { _id: 1 } },
  { v: 2, name: "email_1", key: { email: 1 }, unique: true },
];

/** Admin that records the calls the copy makes; anything else is not expected. Only "shop" has collections. */
function fakeAdmin(targetCount = 7, failing?: string, sourceOptions: Doc = {}) {
  const calls: unknown[][] = [];
  const admin = {
    runPipeline: async (sid: string, db: string, coll: string, pipeline: Doc[], opts: Doc) => {
      calls.push(["runPipeline", sid, db, coll, pipeline]);
      expect(opts).toEqual({ bypassDocumentValidation: true });
      if (failing === "runPipeline") throw "E11000 duplicate key";
    },
    collectionOptions: async () => sourceOptions,
    createCollection: async (sid: string, db: string, coll: string, opts: Doc) =>
      void calls.push(["createCollection", sid, db, coll, opts]),
    convertToCapped: async (sid: string, db: string, coll: string, size: number) =>
      void calls.push(["convertToCapped", sid, db, coll, size]),
    modifyCollection: async (sid: string, db: string, command: Doc) => void calls.push(["modifyCollection", sid, db, command]),
    collStats: async (sid: string, db: string, coll: string) => (calls.push(["collStats", sid, db, coll]), { count: targetCount }),
    listIndexes: async () => INDEXES,
    listCollections: async (_sid: string, db: string) => (db === "shop" ? [{ name: "orders" }, { name: "orders_old" }] : []),
    createIndex: async (sid: string, db: string, coll: string, spec: IndexSpec) => {
      calls.push(["createIndex", sid, db, coll, spec.name]);
      if (failing === "createIndex") throw "index build failed";
    },
    dropCollection: async (sid: string, db: string, coll: string) => void calls.push(["dropCollection", sid, db, coll]),
    renameCollection: async (sid: string, db: string, from: string, to: string, dropTarget?: boolean) => {
      calls.push(["renameCollection", sid, db, from, to, dropTarget]);
      if (failing === "renameCollection") throw "rename failed";
    },
  } as unknown as MongoAdmin;
  return { admin, calls };
}

const TO_ARCHIVE = { source: SOURCE, target: { db: "archive", coll: "orders" }, copyIndexes: false };

describe("explorerService.copyCollection", () => {
  it("copies with $out on the source's server and counts the target", async () => {
    const { admin, calls } = fakeAdmin();
    const copied = await createExplorerService(admin).copyCollection(TO_ARCHIVE);
    expect(copied).toBe(7);
    expect(calls).toEqual([
      ["createCollection", "s1", "archive", "orders", {}],
      ["runPipeline", "s1", "shop", "orders", [{ $match: {} }, { $out: { db: "archive", coll: "orders" } }]],
      ["collStats", "s1", "archive", "orders"],
    ]);
  });

  it("creates the indexes on a new target before the documents", async () => {
    const { admin, calls } = fakeAdmin();
    await createExplorerService(admin).copyCollection({ ...TO_ARCHIVE, copyIndexes: true });
    expect(calls.map((c) => c[0])).toEqual(["createCollection", "createIndex", "runPipeline", "collStats"]);
    expect(calls[1]).toEqual(["createIndex", "s1", "archive", "orders", "email_1"]);
  });

  it("creates a new target with the source's options", async () => {
    const options = { validator: { $jsonSchema: { required: ["email"] } }, collation: { locale: "es" } };
    const { admin, calls } = fakeAdmin(7, undefined, options);
    await createExplorerService(admin).copyCollection(TO_ARCHIVE);
    expect(calls[0]).toEqual(["createCollection", "s1", "archive", "orders", options]);
  });

  it("caps a capped copy after the documents, then adds the indexes", async () => {
    const { admin, calls } = fakeAdmin(7, undefined, { capped: true, size: 4096, max: 10, collation: { locale: "es" } });
    await createExplorerService(admin).copyCollection({ ...TO_ARCHIVE, copyIndexes: true });
    expect(calls).toEqual([
      ["createCollection", "s1", "archive", "orders", { collation: { locale: "es" } }],
      ["runPipeline", "s1", "shop", "orders", [{ $match: {} }, { $out: { db: "archive", coll: "orders" } }]],
      ["convertToCapped", "s1", "archive", "orders", 4096],
      ["modifyCollection", "s1", "archive", { collMod: "orders", cappedMax: 10 }],
      ["createIndex", "s1", "archive", "orders", "email_1"],
      ["collStats", "s1", "archive", "orders"],
    ]);
  });

  it("lets $out create a time series copy and sets its expiry afterwards", async () => {
    const timeseries = { timeField: "t", granularity: "seconds" };
    const { admin, calls } = fakeAdmin(7, undefined, { timeseries, expireAfterSeconds: 60 });
    await createExplorerService(admin).copyCollection({ ...TO_ARCHIVE, target: { db: "shop", coll: "metrics" } });
    expect(calls).toEqual([
      ["runPipeline", "s1", "shop", "orders", [{ $match: {} }, { $out: { db: "shop", coll: "metrics", timeseries } }]],
      ["modifyCollection", "s1", "shop", { collMod: "metrics", expireAfterSeconds: 60 }],
      ["collStats", "s1", "shop", "metrics"],
    ]);
  });

  it("drops a new target if the copy fails", async () => {
    const { admin, calls } = fakeAdmin(7, "runPipeline");
    await expect(createExplorerService(admin).copyCollection({ ...TO_ARCHIVE, copyIndexes: true })).rejects.toBe(
      "E11000 duplicate key",
    );
    expect(calls[calls.length - 1]).toEqual(["dropCollection", "s1", "archive", "orders"]);
  });

  it("never replaces an existing target unless asked", async () => {
    const { admin, calls } = fakeAdmin();
    const service = createExplorerService(admin);
    const request = { ...TO_ARCHIVE, target: { db: "shop", coll: "orders_old" } };
    expect(await service.copyTargetExists(request)).toBe(true);
    await expect(service.copyCollection(request)).rejects.toBe(TARGET_EXISTS);
    expect(calls).toEqual([]);
  });

  it("replaces an existing target when asked, building the copy apart and putting it in its place", async () => {
    const { admin, calls } = fakeAdmin();
    const request = { ...TO_ARCHIVE, target: { db: "shop", coll: "orders_old" }, copyIndexes: true };
    const copied = await createExplorerService(admin, () => "r1").copyCollection(request, true);
    expect(copied).toBe(7);
    expect(calls).toEqual([
      ["createCollection", "s1", "shop", "sharkdb-copy-r1", {}],
      ["createIndex", "s1", "shop", "sharkdb-copy-r1", "email_1"],
      ["runPipeline", "s1", "shop", "orders", [{ $match: {} }, { $out: "sharkdb-copy-r1" }]],
      ["renameCollection", "s1", "shop", "sharkdb-copy-r1", "orders_old", true],
      ["collStats", "s1", "shop", "orders_old"],
    ]);
  });

  it("leaves an existing target as it was when an index of the copy fails", async () => {
    const { admin, calls } = fakeAdmin(7, "createIndex");
    const request = { ...TO_ARCHIVE, target: { db: "shop", coll: "orders_old" }, copyIndexes: true };
    await expect(createExplorerService(admin, () => "r1").copyCollection(request, true)).rejects.toBe("index build failed");
    expect(calls).toEqual([
      ["createCollection", "s1", "shop", "sharkdb-copy-r1", {}],
      ["createIndex", "s1", "shop", "sharkdb-copy-r1", "email_1"],
      ["dropCollection", "s1", "shop", "sharkdb-copy-r1"],
    ]);
  });

  it("leaves an existing target as it was when the documents fail", async () => {
    const { admin, calls } = fakeAdmin(7, "runPipeline");
    const request = { ...TO_ARCHIVE, target: { db: "shop", coll: "orders_old" } };
    await expect(createExplorerService(admin, () => "r1").copyCollection(request, true)).rejects.toBe("E11000 duplicate key");
    expect(calls.map((c) => c[0])).not.toContain("renameCollection");
    expect(calls[calls.length - 1]).toEqual(["dropCollection", "s1", "shop", "sharkdb-copy-r1"]);
  });

  it("drops the provisional copy and keeps the target if putting it in place fails", async () => {
    const { admin, calls } = fakeAdmin(7, "renameCollection");
    const request = { ...TO_ARCHIVE, target: { db: "shop", coll: "orders_old" } };
    await expect(createExplorerService(admin, () => "r1").copyCollection(request, true)).rejects.toBe(
      "rename failed. La colección de destino sigue como estaba",
    );
    expect(calls[calls.length - 1]).toEqual(["dropCollection", "s1", "shop", "sharkdb-copy-r1"]);
  });

  it("refuses to copy a time series over an existing target before touching it", async () => {
    const { admin, calls } = fakeAdmin(7, undefined, { timeseries: { timeField: "t" } });
    const request = { ...TO_ARCHIVE, target: { db: "shop", coll: "orders_old" } };
    await expect(createExplorerService(admin).copyCollection(request, true)).rejects.toBe(TIMESERIES_TARGET_EXISTS);
    expect(calls).toEqual([]);
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
      ["createCollection", "s1", "shop", "orders_copy", {}],
      ["createIndex", "s1", "shop", "orders_copy", "email_1"],
      ["runPipeline", "s1", "shop", "orders", [{ $match: {} }, { $out: "orders_copy" }]],
      ["collStats", "s1", "shop", "orders_copy"],
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

describe("explorerService.replaceIndex", () => {
  const OLD: IndexSpec = { v: 2, name: "email_1", key: { email: 1 }, unique: true };

  /**
   * Admin holding the collection's indexes with the server's rules: an index with the key of
   * another one (85) or the name of another one with a different key (86) is rejected. Its
   * `createIndex` also fails for the names in `failing`, once each.
   */
  function indexAdmin(...failing: string[]) {
    const calls: string[] = [];
    const indexes = new Map<string, Doc>([[OLD.name, OLD.key]]);
    const admin = {
      createIndex: async (_sid: string, _db: string, _coll: string, spec: IndexSpec) => {
        calls.push(`create ${spec.name}`);
        const at = failing.indexOf(spec.name);
        if (at >= 0) {
          failing.splice(at, 1);
          throw `no se pudo crear ${spec.name}`;
        }
        const key = JSON.stringify(spec.key);
        for (const [name, existing] of indexes) {
          if (JSON.stringify(existing) !== key && name === spec.name)
            throw `Index already exists with a different key: ${name}`;
          if (JSON.stringify(existing) === key && name !== spec.name)
            throw `Index with name: ${spec.name} already exists with a different name`;
        }
        indexes.set(spec.name, spec.key);
      },
      dropIndex: async (_sid: string, _db: string, _coll: string, name: string) => {
        calls.push(`drop ${name}`);
        indexes.delete(name);
      },
      modifyCollection: async (_sid: string, _db: string, command: Doc) => void calls.push(`collMod ${JSON.stringify(command)}`),
    } as unknown as MongoAdmin;
    return { service: createExplorerService(admin), calls, names: () => [...indexes.keys()] };
  }

  it("builds the new index before dropping the old one when the key and the name change", async () => {
    const { service, calls, names } = indexAdmin();
    await service.replaceIndex("s1", "shop", "orders", OLD, { name: "email_1_tenant_1", key: { email: 1, tenant: 1 } });
    expect(calls).toEqual(["create email_1_tenant_1", "drop email_1"]);
    expect(names()).toEqual(["email_1_tenant_1"]);
  });

  it("keeps the old index if a new key with a new name can't be built", async () => {
    const { service, calls, names } = indexAdmin("email_1_tenant_1");
    await expect(
      service.replaceIndex("s1", "shop", "orders", OLD, { name: "email_1_tenant_1", key: { email: 1, tenant: 1 } }),
    ).rejects.toBe("no se pudo crear email_1_tenant_1");
    expect(calls).toEqual(["create email_1_tenant_1"]);
    expect(names()).toEqual(["email_1"]);
  });

  it("drops and recreates when the new key keeps the old name", async () => {
    const { service, calls, names } = indexAdmin();
    await service.replaceIndex("s1", "shop", "orders", OLD, { name: "email_1", key: { email: -1 }, unique: true });
    expect(calls).toEqual(["drop email_1", "create email_1"]);
    expect(names()).toEqual(["email_1"]);
  });

  it("restores the original when the new key with the old name can't be built", async () => {
    const { service, calls, names } = indexAdmin("email_1");
    await expect(
      service.replaceIndex("s1", "shop", "orders", OLD, { name: "email_1", key: { email: -1 } }),
    ).rejects.toBe("no se pudo crear email_1");
    expect(calls).toEqual(["drop email_1", "create email_1", "create email_1"]);
    expect(names()).toEqual(["email_1"]);
  });

  it("drops and recreates when only the options change", async () => {
    const { service, calls, names } = indexAdmin();
    await service.replaceIndex("s1", "shop", "orders", OLD, { name: "email_1", key: { email: 1 }, sparse: true });
    expect(calls).toEqual(["drop email_1", "create email_1"]);
    expect(names()).toEqual(["email_1"]);
  });

  it("drops and recreates when only the name changes", async () => {
    const { service, calls, names } = indexAdmin();
    await service.replaceIndex("s1", "shop", "orders", OLD, { name: "by_email", key: { email: 1 }, unique: true });
    expect(calls).toEqual(["drop email_1", "create by_email"]);
    expect(names()).toEqual(["by_email"]);
  });

  it("restores the original when the same key with other options fails", async () => {
    const { service, calls, names } = indexAdmin("email_1");
    await expect(
      service.replaceIndex("s1", "shop", "orders", OLD, { name: "email_1", key: { email: 1 }, sparse: true }),
    ).rejects.toBe("no se pudo crear email_1");
    expect(calls).toEqual(["drop email_1", "create email_1", "create email_1"]);
    expect(names()).toEqual(["email_1"]);
  });

  it("changes only the TTL in place, without dropping the index", async () => {
    const ttl: IndexSpec = { ...OLD, expireAfterSeconds: 3600 };
    const { service, calls } = indexAdmin();
    await service.replaceIndex("s1", "shop", "orders", ttl, { name: "email_1", key: { email: 1 }, unique: true, expireAfterSeconds: 60 });
    expect(calls).toEqual(['collMod {"collMod":"orders","index":{"name":"email_1","expireAfterSeconds":60}}']);
  });

  it("hides the index in place", async () => {
    const { service, calls } = indexAdmin();
    await service.replaceIndex("s1", "shop", "orders", OLD, { name: "email_1", key: { email: 1 }, unique: true, hidden: true });
    expect(calls).toEqual(['collMod {"collMod":"orders","index":{"name":"email_1","hidden":true}}']);
  });

  it("does nothing when nothing the server keeps changes", async () => {
    const { service, calls, names } = indexAdmin();
    await service.replaceIndex("s1", "shop", "orders", OLD, { name: "email_1", key: { email: 1 }, unique: true, background: true });
    expect(calls).toEqual([]);
    expect(names()).toEqual(["email_1"]);
  });

  it("rebuilds when the TTL changes along with other options", async () => {
    const ttl: IndexSpec = { ...OLD, expireAfterSeconds: 3600 };
    const { service, calls } = indexAdmin();
    await service.replaceIndex("s1", "shop", "orders", ttl, { name: "email_1", key: { email: 1 }, expireAfterSeconds: 60 });
    expect(calls).toEqual(["drop email_1", "create email_1"]);
  });

  it("says so when the original can't be restored either", async () => {
    const { service, names } = indexAdmin("email_1", "email_1");
    await expect(
      service.replaceIndex("s1", "shop", "orders", OLD, { name: "email_1", key: { email: 1 }, sparse: true }),
    ).rejects.toMatch(/Tampoco se pudo restaurar el índice original “email_1”.*se quedó sin él/);
    expect(names()).toEqual([]);
  });
});

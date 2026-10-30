import {
  copyPipeline,
  duplicateRequest,
  indexesToCopy,
  TARGET_EXISTS,
  validateCopy,
  type CollectionRef,
  type CopyRequest,
} from "../domain/copySpec";
import { creatableSpec } from "../domain/indexSpec";
import { SYSTEM_DATABASES, type CollectionEntry, type DatabaseEntry, type IndexSpec } from "../domain/mongo";
import { childNode, withSystemFolder, type TreeNode } from "../domain/tree";
import type { MongoAdmin } from "./ports";

export type ExplorerService = ReturnType<typeof createExplorerService>;

export function createExplorerService(admin: MongoAdmin) {
  const database = (parent: TreeNode, d: DatabaseEntry) =>
    childNode(parent, "database", d.name, { db: d.name, data: d });
  const collection = (parent: TreeNode, c: CollectionEntry) =>
    childNode(parent, "collection", c.name, { coll: c.name, data: c });

  /** Children of a tree node, fetched the first time it is expanded. */
  async function loadChildren(n: TreeNode): Promise<TreeNode[]> {
    switch (n.kind) {
      case "server": {
        const dbs = await admin.listDatabases(n.sid);
        return withSystemFolder(n, "systemDbs", dbs, (d) => SYSTEM_DATABASES.includes(d.name), database);
      }
      case "systemDbs":
      case "systemCollections":
        return n.data.children;
      case "database":
        return [
          childNode(n, "collections", "Collections"),
          childNode(n, "functions", "Functions"),
          childNode(n, "users", "Users"),
        ];
      case "collections": {
        const colls = await admin.listCollections(n.sid, n.db!);
        return withSystemFolder(n, "systemCollections", colls, (c) => c.name.startsWith("system."), collection);
      }
      case "collection":
        return [childNode(n, "indexes", "Indexes")];
      case "indexes":
        return (await admin.listIndexes(n.sid, n.db!, n.coll!)).map((ix) =>
          childNode(n, "index", ix.name, { data: ix }),
        );
      case "users":
        return (await admin.listUsers(n.sid, n.db!)).map((u) => childNode(n, "user", u.user, { data: u }));
      case "functions":
        return (await admin.listFunctions(n.sid, n.db!)).map((f) =>
          childNode(n, "function", String(f._id), { data: f }),
        );
      default:
        return [];
    }
  }

  /**
   * MongoDB can't modify an index in place, so (like Robo 3T) edit = drop + create. If the new
   * index fails to build, the original one is restored.
   */
  async function replaceIndex(sid: string, db: string, coll: string, old: IndexSpec, next: IndexSpec) {
    await admin.dropIndex(sid, db, coll, old.name);
    try {
      await admin.createIndex(sid, db, coll, next);
    } catch (e) {
      await admin.createIndex(sid, db, coll, creatableSpec(old)).catch(() => {});
      throw e;
    }
  }

  /**
   * Copies a collection to another database of the same server, replacing the target: the server
   * does it (`$out`). Indexes are recreated afterwards if asked. Resolves with the documents in the target.
   */
  async function copyCollection(request: CopyRequest): Promise<number> {
    const valid = validateCopy(request);
    const { source, target, copyIndexes } = valid;
    const { sid } = source;
    await admin.runPipeline(sid, source.db, source.coll, copyPipeline(valid));
    const copied = (await admin.collStats(sid, target.db, target.coll)).count ?? 0;
    if (copyIndexes) {
      for (const ix of indexesToCopy(await admin.listIndexes(sid, source.db, source.coll))) {
        await admin.createIndex(sid, target.db, target.coll, ix);
      }
    }
    return copied;
  }

  /**
   * Copy of a collection, with its indexes, under a new name in the same database. Unlike a copy it
   * never replaces anything: an existing target is an error.
   */
  async function duplicateCollection(source: CollectionRef, name: string): Promise<number> {
    const request = validateCopy(duplicateRequest(source, name));
    const existing = await admin.listCollections(source.sid, source.db);
    if (existing.some((c) => c.name === request.target.coll)) throw TARGET_EXISTS;
    return copyCollection(request);
  }

  return { ...admin, loadChildren, replaceIndex, copyCollection, duplicateCollection };
}

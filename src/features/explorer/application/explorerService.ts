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
import { SYSTEM_DATABASES, type CollectionEntry, type Doc, type IndexSpec } from "../domain/mongo";
import { hasUserDatabases, visibleDatabases, type VisibleDatabase } from "../domain/pinnedDatabases";
import { childNode, withSystemFolder, type TreeNode } from "../domain/tree";
import {
  collModCommand,
  readValidation,
  removeValidationCommand,
  validatorFrom,
  type CollectionValidation,
  type ValidationSettings,
} from "../domain/validation";
import type { MongoAdmin } from "./ports";

export type ExplorerService = ReturnType<typeof createExplorerService>;

export function createExplorerService(admin: MongoAdmin) {
  // What the explorer shows of each connection (by session id): its saved favorites, and the
  // temporary databases opened during this run, which are never saved.
  const favorites = new Map<string, string[]>();
  const temporaries = new Map<string, Set<string>>();

  const temporariesOf = (sid: string) => [...(temporaries.get(sid) ?? [])];

  /** The connection's favorites as saved; the caller persists them. */
  const setFavorites = (sid: string, names: string[]) => void favorites.set(sid, [...names]);
  const favoritesOf = (sid: string) => favorites.get(sid) ?? [];

  /** Shows `names` until the app closes (or they're removed from the list). */
  const openTemporary = (sid: string, names: string[]) =>
    void temporaries.set(sid, new Set([...temporariesOf(sid), ...names]));

  const forgetTemporary = (sid: string, name: string) => void temporaries.get(sid)?.delete(name);

  /** Whether the connection shows a database of the user's: if not, the user must choose (or create) one. */
  const hasPinned = (sid: string) => hasUserDatabases(favoritesOf(sid), temporariesOf(sid));

  const database = (parent: TreeNode, d: VisibleDatabase) =>
    childNode(parent, "database", d.name, { db: d.name, data: d });
  const collection = (parent: TreeNode, c: CollectionEntry) =>
    childNode(parent, "collection", c.name, { coll: c.name, data: c });

  /** Children of a tree node, fetched the first time it is expanded. */
  async function loadChildren(n: TreeNode): Promise<TreeNode[]> {
    switch (n.kind) {
      case "server": {
        const existing = await admin.listDatabases(n.sid);
        const dbs = visibleDatabases(favoritesOf(n.sid), temporariesOf(n.sid), existing);
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

  /** The validation the collection has on the server, however it was set (robo3B, a script, another app). */
  const validationOf = async (ref: CollectionRef): Promise<CollectionValidation> =>
    readValidation(await admin.collectionOptions(ref.sid, ref.db, ref.coll));

  /** Stores the edited rule (a `$jsonSchema`, or the whole validator) with these settings. */
  const saveValidation = (ref: CollectionRef, rule: Doc, wholeValidator: boolean, settings: ValidationSettings) =>
    admin.modifyCollection(
      ref.sid,
      ref.db,
      collModCommand(ref.coll, validatorFrom(rule, wholeValidator, settings.extraFields), settings),
    );

  const removeValidation = (ref: CollectionRef) => admin.modifyCollection(ref.sid, ref.db, removeValidationCommand(ref.coll));

  return {
    ...admin,
    validationOf,
    saveValidation,
    removeValidation,
    loadChildren,
    replaceIndex,
    copyCollection,
    duplicateCollection,
    setFavorites,
    favoritesOf,
    openTemporary,
    forgetTemporary,
    temporariesOf,
    hasPinned,
  };
}

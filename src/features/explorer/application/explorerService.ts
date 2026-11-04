import {
  COPY_PIPELINE_OPTIONS,
  copyOptions,
  copyPipeline,
  copyRunId,
  copyStagingName,
  duplicateRequest,
  indexesAfterDocuments,
  indexesToCopy,
  TARGET_EXISTS,
  TIMESERIES_TARGET_EXISTS,
  validateCopy,
  type CollectionRef,
  type CopyOptions,
  type CopyRequest,
} from "../domain/copySpec";
import { creatableSpec, inPlaceIndexChange } from "../domain/indexSpec";
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
import { errorMessage } from "../../../shared/errors";
import type { MongoAdmin } from "./ports";

/** Index keys are ordered: `{ a: 1, b: 1 }` and `{ b: 1, a: 1 }` are different indexes. */
const sameKey = (a: Doc, b: Doc) => JSON.stringify(a) === JSON.stringify(b);

export type ExplorerService = ReturnType<typeof createExplorerService>;

export function createExplorerService(admin: MongoAdmin, newId: () => string = copyRunId) {
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
   * A change of only the TTL or `hidden` is made in place (`collMod`), keeping the index. Anything
   * else MongoDB can't modify in place. With a different key and name the new index is built
   * before the old one is dropped, so the collection is never left without one of them: losing a
   * `unique` index lets duplicates in. Otherwise the server doesn't allow both (same key: "already
   * exists with a different name"; same name: "already exists with different options"), so it's
   * drop + create, restoring the original if the build fails.
   */
  async function replaceIndex(sid: string, db: string, coll: string, old: IndexSpec, next: IndexSpec) {
    const inPlace = inPlaceIndexChange(coll, old, next);
    if (inPlace) {
      if (Object.keys(inPlace.index as Doc).length > 1) await admin.modifyCollection(sid, db, inPlace);
      return;
    }
    const spec = creatableSpec(next);
    if (!sameKey(old.key, next.key) && next.name !== old.name) {
      await admin.createIndex(sid, db, coll, spec);
      await admin.dropIndex(sid, db, coll, old.name);
      return;
    }
    await admin.dropIndex(sid, db, coll, old.name);
    try {
      await admin.createIndex(sid, db, coll, spec);
    } catch (e) {
      try {
        await admin.createIndex(sid, db, coll, creatableSpec(old));
      } catch (restore) {
        throw `${errorMessage(e)}. Tampoco se pudo restaurar el índice original “${old.name}” (${errorMessage(restore)}): la colección se quedó sin él`;
      }
      throw e;
    }
  }

  /** Whether the copy's destination already exists, so copying would replace it. */
  async function copyTargetExists(request: CopyRequest): Promise<boolean> {
    const { source, target } = validateCopy(request);
    const existing = await admin.listCollections(source.sid, target.db);
    return existing.some((c) => c.name === target.coll);
  }

  /**
   * Copies a collection to another database of the same server: the server does it (`$out`).
   * The copy is built in a new collection, created with the source's options (`copyOptions`) and,
   * when it can, given the indexes before the documents; a failure leaves nothing half done: that
   * collection is dropped. An existing target is only replaced with `replace` (after the user
   * confirmed it): the copy is built in a provisional collection of its database that takes its
   * place at the end (`dropTarget`), so the target ends up like the source or stays as it was.
   * Resolves with the documents in the target.
   */
  async function copyCollection(request: CopyRequest, replace = false): Promise<number> {
    const valid = validateCopy(request);
    const { source, target } = valid;
    const { sid } = source;
    const exists = await copyTargetExists(valid);
    if (exists && !replace) throw TARGET_EXISTS;
    const options = copyOptions(await admin.collectionOptions(sid, source.db, source.coll));
    if (!exists) {
      await buildCopy(valid, options);
    } else {
      if (options.timeseries) throw TIMESERIES_TARGET_EXISTS;
      const staging = copyStagingName(newId());
      await buildCopy({ ...valid, target: { db: target.db, coll: staging } }, options);
      try {
        await admin.renameCollection(sid, target.db, staging, target.coll, true);
      } catch (e) {
        await admin.dropCollection(sid, target.db, staging).catch(() => {});
        throw `${errorMessage(e)}. La colección de destino sigue como estaba`;
      }
    }
    return (await admin.collStats(sid, target.db, target.coll)).count ?? 0;
  }

  /** Fills `request.target`, which doesn't exist yet, with the copy; drops it if anything fails after creating it. */
  async function buildCopy(request: CopyRequest, options: CopyOptions) {
    const { source, target, copyIndexes } = request;
    const { sid } = source;
    const indexes = copyIndexes ? indexesToCopy(await admin.listIndexes(sid, source.db, source.coll)) : [];
    const late = indexesAfterDocuments(options);
    // Until this copy has created the target, a failure (another process created it in between,
    // NamespaceExists) must not drop it: it isn't ours.
    let created = false;
    try {
      if (options.create) {
        await admin.createCollection(sid, target.db, target.coll, options.create);
        created = true;
      }
      if (!late) for (const ix of indexes) await admin.createIndex(sid, target.db, target.coll, ix);
      await admin.runPipeline(sid, source.db, source.coll, copyPipeline(request, options.timeseries), COPY_PIPELINE_OPTIONS);
      created = true; // a time series target is created by `$out` itself
      if (options.capped) {
        await admin.convertToCapped(sid, target.db, target.coll, options.capped.size);
        if (options.capped.max) await admin.modifyCollection(sid, target.db, { collMod: target.coll, cappedMax: options.capped.max });
      }
      if (options.expireAfterSeconds != null)
        await admin.modifyCollection(sid, target.db, { collMod: target.coll, expireAfterSeconds: options.expireAfterSeconds });
      if (late) for (const ix of indexes) await admin.createIndex(sid, target.db, target.coll, ix);
    } catch (e) {
      // If dropping fails too, an empty or partial collection is left.
      if (created) await admin.dropCollection(sid, target.db, target.coll).catch(() => {});
      throw e;
    }
  }

  /**
   * Copy of a collection, with its indexes, under a new name in the same database. Unlike a copy it
   * never replaces anything: an existing target is an error.
   */
  const duplicateCollection = (source: CollectionRef, name: string): Promise<number> =>
    copyCollection(duplicateRequest(source, name));

  /** The validation the collection has on the server, however it was set (SharkDB, a script, another app). */
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
    copyTargetExists,
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

// MongoAdmin built on database commands. Commands are plain objects; key order is kept all the
// way to the driver, so the command name must come first.
import { firstBatch, type CommandRunner } from "../../../shared/infrastructure/commandRunner";
import type { MongoAdmin } from "../application/ports";
import type { CollectionEntry, DatabaseEntry, Doc, FunctionEntry, IndexSpec, UserEntry } from "../domain/mongo";

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

export function createCommandMongoAdmin(run: CommandRunner): MongoAdmin {
  // Write commands: the reply carries nothing the callers need.
  const exec = async (sid: string, db: string, command: Doc) => {
    await run(sid, db, command);
  };

  return {
    async listDatabases(sid) {
      const r = await run(sid, "admin", { listDatabases: 1, authorizedDatabases: true });
      return (r.databases as DatabaseEntry[]).sort(byName);
    },
    async listCollections(sid, db) {
      return firstBatch<CollectionEntry>(await run(sid, db, { listCollections: 1 })).sort(byName);
    },
    async listIndexes(sid, db, coll) {
      return firstBatch<IndexSpec>(await run(sid, db, { listIndexes: coll }));
    },
    async listUsers(sid, db) {
      const r = await run(sid, db, { usersInfo: 1 });
      return (r.users as UserEntry[]).sort((a, b) => a.user.localeCompare(b.user));
    },
    async listFunctions(sid, db) {
      return firstBatch<FunctionEntry>(await run(sid, db, { find: "system.js", batchSize: 1000 }));
    },

    serverStatus: (sid) => run(sid, "admin", { serverStatus: 1 }),
    hostInfo: (sid) => run(sid, "admin", { hostInfo: 1 }),
    buildInfo: (sid) => run(sid, "admin", { buildInfo: 1 }),
    dbStats: (sid, db) => run(sid, db, { dbStats: 1 }),
    async collStats(sid, db, coll) {
      const r = await run(sid, db, { collStats: coll });
      // Per-engine and per-index internals are huge and not useful in the summary.
      delete r.wiredTiger;
      delete r.indexDetails;
      return r;
    },

    createCollection: (sid, db, name, opts = {}) => exec(sid, db, { create: name, ...opts }),
    dropCollection: (sid, db, name) => exec(sid, db, { drop: name }),
    dropDatabase: (sid, db) => exec(sid, db, { dropDatabase: 1 }),
    renameCollection: (sid, db, from, to) =>
      exec(sid, "admin", { renameCollection: `${db}.${from}`, to: `${db}.${to}` }),

    createIndex: (sid, db, coll, spec) => exec(sid, db, { createIndexes: coll, indexes: [spec] }),
    dropIndex: (sid, db, coll, name) => exec(sid, db, { dropIndexes: coll, index: name }),

    dropUser: (sid, db, user) => exec(sid, db, { dropUser: user }),
    removeFunction: (sid, db, name) =>
      exec(sid, db, { delete: "system.js", deletes: [{ q: { _id: name }, limit: 1 }] }),
  };
}

import type { CollectionEntry, DatabaseEntry, Doc, FunctionEntry, IndexSpec, UserEntry } from "../domain/mongo";

/** Administrative operations on an open server session (`sid`). */
export interface MongoAdmin {
  listDatabases(sid: string): Promise<DatabaseEntry[]>;
  listCollections(sid: string, db: string): Promise<CollectionEntry[]>;
  listIndexes(sid: string, db: string, coll: string): Promise<IndexSpec[]>;
  listUsers(sid: string, db: string): Promise<UserEntry[]>;
  listFunctions(sid: string, db: string): Promise<FunctionEntry[]>;

  serverStatus(sid: string): Promise<Doc>;
  hostInfo(sid: string): Promise<Doc>;
  buildInfo(sid: string): Promise<Doc>;
  dbStats(sid: string, db: string): Promise<Doc>;
  collStats(sid: string, db: string, coll: string): Promise<Doc>;

  createCollection(sid: string, db: string, name: string, opts?: Doc): Promise<void>;
  dropCollection(sid: string, db: string, name: string): Promise<void>;
  dropDatabase(sid: string, db: string): Promise<void>;
  renameCollection(sid: string, db: string, from: string, to: string): Promise<void>;

  createIndex(sid: string, db: string, coll: string, spec: IndexSpec): Promise<void>;
  dropIndex(sid: string, db: string, coll: string, name: string): Promise<void>;

  dropUser(sid: string, db: string, user: string): Promise<void>;
  removeFunction(sid: string, db: string, name: string): Promise<void>;
}

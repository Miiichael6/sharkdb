// Scripts a shell tab opened from the explorer's context menus starts with, as in Robo 3T.

/** `db.getCollection('…')` for a collection name, escaping its quotes. */
export const collectionExpr = (coll: string) => `db.getCollection('${coll.replace(/'/g, "\\'")}')`;

export type CollectionScriptKind =
  | "viewDocuments"
  | "updateDocuments"
  | "removeDocuments"
  | "viewIndexes"
  | "shardVersion"
  | "shardDistribution";

/** Scripts on the whole server (the connection's menu). */
export type ServerScriptKind = "showLog";

export type MenuScriptKind = CollectionScriptKind | ServerScriptKind;

export interface MenuScript {
  code: string;
  /** Run as soon as the tab opens; write templates wait for the user to fill them in. */
  run: boolean;
}

const UPDATE_TEMPLATE = `.update(
    // query
    {
        "key" : "value"
    },
    // update
    {
        "$set" : { "key" : "value" }
    },
    // options
    {
        "multi" : false,  // update only one document
        "upsert" : false  // insert a new document, if no existing document match the query
    }
);`;

const REMOVE_TEMPLATE = `.remove(
    // query
    {
        "key" : "value"
    },
    // justOne
    true
);`;

/** Collection scripts, as the code that follows `db.getCollection('…')`. */
const COLLECTION_SCRIPTS: Record<CollectionScriptKind, MenuScript> = {
  viewDocuments: { code: ".find({})", run: true },
  updateDocuments: { code: UPDATE_TEMPLATE, run: false },
  removeDocuments: { code: REMOVE_TEMPLATE, run: false },
  viewIndexes: { code: ".getIndexes()", run: true },
  shardVersion: { code: ".getShardVersion()", run: true },
  shardDistribution: { code: ".getShardDistribution()", run: true },
};

const SERVER_SCRIPTS: Record<ServerScriptKind, MenuScript> = {
  showLog: { code: "db.adminCommand({ getLog: 'global' })", run: true },
};

const has = (table: object, key: string) => Object.prototype.hasOwnProperty.call(table, key);

export const isCollectionScript = (action: string): action is CollectionScriptKind => has(COLLECTION_SCRIPTS, action);
export const isServerScript = (action: string): action is ServerScriptKind => has(SERVER_SCRIPTS, action);
export const isMenuScript = (action: string): action is MenuScriptKind => isCollectionScript(action) || isServerScript(action);

/** Script for `kind` on collection `coll`. */
export function collectionScript(kind: CollectionScriptKind, coll: string): MenuScript {
  const { code, run } = COLLECTION_SCRIPTS[kind];
  return { code: collectionExpr(coll) + code, run };
}

/** Script for `kind` on a node with collection `coll` (if any); null when `kind` needs a collection and there is none. */
export function menuScript(kind: MenuScriptKind, coll?: string): MenuScript | null {
  if (isServerScript(kind)) return SERVER_SCRIPTS[kind];
  return coll ? collectionScript(kind, coll) : null;
}

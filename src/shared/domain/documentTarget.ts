// The collection a document operation works on, shared by the features that offer document actions.

export interface DocumentTarget {
  sid: string;
  db: string;
  coll: string;
}

/**
 * Why the documents of a result aren't the whole documents of `DocumentTarget`'s collection:
 * an aggregate (its `_id` may be another), a projection, or a view / timeseries.
 */
export type Uneditable = "aggregate" | "projection" | "readOnlyCollection";

/** The connection a target's `sid` names, as the user knows it: name, address and environment tag. */
export interface TargetServer {
  name: string;
  /** `host:port` (or the hosts of its URI). */
  host: string;
  tag?: string;
}

/** Where a write lands, shown over editors and confirmations so it can't be mistaken. */
export interface TargetWhere {
  server: TargetServer;
  db: string;
  coll?: string;
}

/** "LOCAL · shop.orders", for logs. */
export const describeWhere = (w: TargetWhere) => `${w.server.name} · ${w.coll ? `${w.db}.${w.coll}` : w.db}`;

/** Target of a namespace `db.coll`; collection names may contain dots, database names can't. */
export function targetOfNamespace(sid: string, ns: string): DocumentTarget | null {
  const dot = ns.indexOf(".");
  if (dot <= 0 || dot === ns.length - 1) return null;
  return { sid, db: ns.slice(0, dot), coll: ns.slice(dot + 1) };
}

// The collection a document operation works on, shared by the features that offer document actions.

export interface DocumentTarget {
  sid: string;
  db: string;
  coll: string;
}

/** Target of a namespace `db.coll`; collection names may contain dots, database names can't. */
export function targetOfNamespace(sid: string, ns: string): DocumentTarget | null {
  const dot = ns.indexOf(".");
  if (dot <= 0 || dot === ns.length - 1) return null;
  return { sid, db: ns.slice(0, dot), coll: ns.slice(dot + 1) };
}

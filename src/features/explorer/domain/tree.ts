// Explorer tree model, following Robo 3T's layout:
//   Server (N) ─ System (admin/config/local) ─ <db>
//   <db> ─ Collections (N) [System (system.*)] ─ Functions (N) ─ Users (N)
//   <collection> ─ Indexes (N) ─ <index>

export type NodeKind =
  | "server"
  | "systemDbs"
  | "database"
  | "collections"
  | "systemCollections"
  | "functions"
  | "users"
  | "collection"
  | "indexes"
  | "index"
  | "user"
  | "function";

export interface TreeNode {
  key: string;
  kind: NodeKind;
  label: string;
  sid: string;
  db?: string;
  coll?: string;
  /** Kind-specific payload: the index spec, the user doc, a view's options, preset children... */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

export const FOLDER_KINDS: NodeKind[] = [
  "systemDbs",
  "collections",
  "systemCollections",
  "functions",
  "users",
  "indexes",
];

// Unit separator: never appears in database or collection names.
const SEP = "\u001f";

export const parentKey = (key: string) => {
  const i = key.lastIndexOf(SEP);
  return i < 0 ? null : key.slice(0, i);
};

export const childKey = (parent: string, kind: NodeKind, label: string) => `${parent}${SEP}${kind}:${label}`;

/** True for `key` itself and every node below it. */
export const isWithin = (key: string, ancestor: string) => key === ancestor || key.startsWith(ancestor + SEP);

export const childNode = (parent: TreeNode, kind: NodeKind, label: string, extra: Partial<TreeNode> = {}): TreeNode => ({
  key: childKey(parent.key, kind, label),
  kind,
  label,
  sid: parent.sid,
  db: parent.db,
  coll: parent.coll,
  ...extra,
});

export const serverNode = (sid: string, label: string): TreeNode => ({
  key: `server:${sid}`,
  kind: "server",
  label,
  sid,
});

export function isLeaf(n: TreeNode): boolean {
  if (n.kind === "collection") return n.data?.type === "view";
  return n.kind === "index" || n.kind === "user" || n.kind === "function";
}

/** Groups the items matching `isSystem` under a "System" folder node, as Robo 3T does. */
export function withSystemFolder<T>(
  parent: TreeNode,
  folderKind: NodeKind,
  items: T[],
  isSystem: (item: T) => boolean,
  toNode: (parent: TreeNode, item: T) => TreeNode,
): TreeNode[] {
  const user = items.filter((i) => !isSystem(i)).map((i) => toNode(parent, i));
  const system = items.filter(isSystem);
  if (!system.length) return user;
  const folder = childNode(parent, folderKind, "System");
  folder.data = { children: system.map((i) => toNode(folder, i)) };
  return [folder, ...user];
}

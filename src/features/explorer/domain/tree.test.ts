import { describe, expect, it } from "vitest";
import { childKey, childNode, databaseNode, databaseNodes, isLeaf, isWithin, parentKey, serverNode, withSystemFolder } from "./tree";

describe("childKey / parentKey", () => {
  it("round-trips through several levels", () => {
    const server = "server:abc";
    const db = childKey(server, "database", "shop");
    const coll = childKey(db, "collection", "orders.v2");
    expect(parentKey(coll)).toBe(db);
    expect(parentKey(db)).toBe(server);
    expect(parentKey(server)).toBeNull();
  });

  it("keeps labels containing dots, colons and slashes intact", () => {
    const key = childKey("server:x", "collection", "a.b:c/d");
    expect(parentKey(key)).toBe("server:x");
  });
});

describe("isWithin", () => {
  it("matches the node itself and its descendants, not siblings with the same prefix", () => {
    const db = childKey("server:x", "database", "shop");
    expect(isWithin(db, db)).toBe(true);
    expect(isWithin(childKey(db, "collections", "Collections"), db)).toBe(true);
    expect(isWithin(childKey("server:x", "database", "shop2"), db)).toBe(false);
  });
});

describe("withSystemFolder", () => {
  it("groups system items under a leading System folder", () => {
    const db = childNode(serverNode("x", "local"), "database", "shop", { db: "shop" });
    const nodes = withSystemFolder(db, "systemCollections", ["system.views", "orders"], (n) => n.startsWith("system."), (p, n) =>
      childNode(p, "collection", n, { coll: n }),
    );
    expect(nodes.map((n) => n.label)).toEqual(["System", "orders"]);
    expect(nodes[0].data.children.map((n: { label: string }) => n.label)).toEqual(["system.views"]);
  });
});

describe("databaseNodes", () => {
  it("lists user databases first, then the ones in the System folder", () => {
    const server = serverNode("s1", "local");
    const db = (parent: typeof server, name: string) => childNode(parent, "database", name, { db: name });
    const kids = withSystemFolder(server, "systemDbs", ["admin", "shop", "local", "crm"], (d) => ["admin", "local"].includes(d), db);
    expect(databaseNodes(kids).map((n) => n.label)).toEqual(["shop", "crm", "admin", "local"]);
    expect(databaseNodes([])).toEqual([]);
  });
});

describe("databaseNode", () => {
  const server = serverNode("s1", "Local");
  const loaded = withSystemFolder(server, "systemDbs", ["admin", "shop"], (d) => d === "admin", (p, d) =>
    childNode(p, "database", d, { db: d }),
  );

  it("has the key the server's loaded children give it, inside System for a system database", () => {
    expect(databaseNode(server, "shop").key).toBe(databaseNodes(loaded).find((n) => n.db === "shop")!.key);
    expect(databaseNode(server, "admin").key).toBe(databaseNodes(loaded).find((n) => n.db === "admin")!.key);
  });

  it("makes a missing favorite a leaf", () => {
    expect(isLeaf({ ...databaseNode(server, "gone"), data: { missing: true } })).toBe(true);
    expect(isLeaf(databaseNode(server, "shop"))).toBe(false);
  });
});

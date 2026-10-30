import { describe, expect, it } from "vitest";
import { childKey, childNode, isWithin, parentKey, serverNode, withSystemFolder } from "./tree";

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

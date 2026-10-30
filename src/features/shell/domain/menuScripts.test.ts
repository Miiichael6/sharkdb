import { describe, expect, it } from "vitest";
import { collectionExpr, collectionScript, isCollectionScript, isMenuScript, isServerScript, menuScript } from "./menuScripts";

describe("menuScripts", () => {
  it("addresses the collection with getCollection, escaping quotes", () => {
    expect(collectionExpr("it's")).toBe("db.getCollection('it\\'s')");
  });

  it("runs reads right away and leaves write templates for the user to fill in", () => {
    expect(collectionScript("viewDocuments", "users")).toEqual({ code: "db.getCollection('users').find({})", run: true });
    expect(collectionScript("shardVersion", "users")).toEqual({ code: "db.getCollection('users').getShardVersion()", run: true });
    expect(collectionScript("shardDistribution", "users").run).toBe(true);
    for (const kind of ["updateDocuments", "removeDocuments"] as const) {
      expect(collectionScript(kind, "users").run).toBe(false);
    }
  });

  it("starts the write templates on the collection", () => {
    expect(collectionScript("updateDocuments", "users").code).toMatch(/^db\.getCollection\('users'\)\.update\(/);
    expect(collectionScript("removeDocuments", "users").code).toMatch(/^db\.getCollection\('users'\)\.remove\(/);
  });

  it("lists a collection's indexes right away", () => {
    expect(collectionScript("viewIndexes", "users")).toEqual({ code: "db.getCollection('users').getIndexes()", run: true });
  });

  it("shows the server's global log without a collection", () => {
    expect(menuScript("showLog")).toEqual({ code: "db.adminCommand({ getLog: 'global' })", run: true });
    expect(menuScript("showLog", "users")?.code).toBe("db.adminCommand({ getLog: 'global' })");
  });

  it("has no collection script for a node without a collection", () => {
    expect(menuScript("viewDocuments")).toBeNull();
    expect(menuScript("viewIndexes", "users")?.code).toBe("db.getCollection('users').getIndexes()");
  });

  it("tells script actions apart from the rest", () => {
    expect(isServerScript("showLog")).toBe(true);
    expect(isCollectionScript("showLog")).toBe(false);
    expect(isMenuScript("showLog") && isMenuScript("viewIndexes")).toBe(true);
    expect(isMenuScript("rebuildIndexes")).toBe(false);
    expect(isCollectionScript("updateDocuments")).toBe(true);
    expect(isCollectionScript("dropCollection")).toBe(false);
    expect(isCollectionScript("toString")).toBe(false);
  });
});

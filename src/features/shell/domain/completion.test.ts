import { describe, expect, it } from "vitest";
import { completionContext, fieldPaths, suggestionsFor } from "./completion";
import { COLLECTION_METHODS, CURSOR_METHODS, DB_METHODS } from "./shellApi";

const ctx = (text: string) => completionContext(text);
const labels = (text: string, data = { collections: ["users", "orders"], fields: ["_id", "name"] }) =>
  suggestionsFor(ctx(text)!, data).map((s) => s.label);

describe("completionContext", () => {
  it("offers collections and DB methods after db.", () => {
    expect(ctx("db.us")).toEqual({ kind: "db", from: 3, prefix: "us" });
    expect(labels("db.")).toEqual(["users", "orders", ...DB_METHODS]);
    expect(ctx("x = foo.db.")).toBeNull();
  });

  it("offers collection names inside getCollection('", () => {
    expect(ctx("db.getCollection('or")).toEqual({ kind: "collectionName", from: 18, prefix: "or" });
    expect(labels('db.getCollection("')).toEqual(["users", "orders"]);
  });

  it("offers collection methods after a collection", () => {
    expect(ctx("db.users.fi")).toEqual({ kind: "collection", from: 9, prefix: "fi", collection: "users" });
    expect(ctx("db.getCollection('my.coll').")).toMatchObject({ kind: "collection", collection: "my.coll" });
    expect(labels("db.users.")).toEqual(COLLECTION_METHODS);
  });

  it("does not take DB methods for collections", () => {
    expect(ctx("db.getCollectionNames().")).toBeNull();
  });

  it("offers cursor methods after find/aggregate and chained modifiers", () => {
    expect(ctx("db.users.find({}).")).toMatchObject({ kind: "cursor" });
    expect(ctx("db.users.find({ a: ')' }).sort({ _id: -1 }).li")).toEqual({ kind: "cursor", from: 44, prefix: "li" });
    expect(labels("db.x.aggregate([]).")).toEqual(CURSOR_METHODS);
    expect(ctx("db.users.findOne({}).")).toBeNull();
    expect(ctx("foo().sort().")).toBeNull();
  });

  it("offers fields and operators at key positions inside a collection call", () => {
    expect(ctx("db.users.find({ na")).toEqual({ kind: "field", from: 16, prefix: "na", collection: "users" });
    expect(ctx("db.users.find({ a: 1, ")).toMatchObject({ kind: "field", prefix: "" });
    expect(ctx('db.users.find({ "addr.ci')).toMatchObject({ kind: "field", prefix: "addr.ci" });
    expect(ctx("db.users.find({ age: { $g")).toMatchObject({ kind: "field", prefix: "$g" });
    expect(ctx("db.users.aggregate([{ $match: { ")).toMatchObject({ kind: "field", collection: "users" });
    expect(labels("db.users.find({ ")).toContain("name");
    expect(labels("db.users.find({ $")).not.toContain("name");
    expect(labels("db.users.find({ $")).toContain("$or");
  });

  it("does not offer fields at value positions or outside collection calls", () => {
    expect(ctx("db.users.find({ name: ")).toMatchObject({ kind: "global" });
    expect(ctx("var q = { na")).toMatchObject({ kind: "global" });
  });

  it("offers globals for bare words, and nothing inside strings or comments", () => {
    expect(ctx("var x = Obj")).toEqual({ kind: "global", from: 8, prefix: "Obj" });
    expect(ctx("print('db.")).toBeNull();
    expect(ctx("// db.")).toBeNull();
    expect(ctx("/* db.users.")).toBeNull();
    expect(ctx("foo.ba")).toBeNull();
  });
});

describe("fieldPaths", () => {
  it("collects sorted dotted paths, treating Extended JSON wrappers and arrays as values", () => {
    const docs = [
      { _id: { $oid: "1" }, name: "a", addr: { city: "x", geo: { lat: 1, deep: { no: 1 } } } },
      { _id: { $oid: "2" }, tags: ["a"], age: 3 },
    ];
    expect(fieldPaths(docs)).toEqual(["_id", "addr", "addr.city", "addr.geo", "addr.geo.deep", "addr.geo.lat", "age", "name", "tags"]);
  });
});

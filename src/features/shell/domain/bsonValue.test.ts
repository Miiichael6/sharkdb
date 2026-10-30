import { describe, expect, it } from "vitest";
import { bsonValue, childrenOf } from "./bsonValue";

describe("bsonValue", () => {
  it("recognises canonical Extended JSON wrappers", () => {
    expect(bsonValue({ $oid: "5f1d7a3c9b1e8a0012345678" })).toEqual({ type: "objectId", hex: "5f1d7a3c9b1e8a0012345678" });
    expect(bsonValue({ $date: { $numberLong: "1704189600000" } })).toEqual({ type: "date", ms: 1704189600000 });
    expect(bsonValue({ $numberInt: "7" })).toEqual({ type: "int32", value: 7 });
    expect(bsonValue({ $numberLong: "9007199254740993" })).toEqual({ type: "int64", value: "9007199254740993" });
    expect(bsonValue({ $numberDouble: "1.5" })).toEqual({ type: "double", value: "1.5" });
    expect(bsonValue({ $numberDecimal: "0.1" })).toEqual({ type: "decimal", value: "0.1" });
    expect(bsonValue({ $regularExpression: { pattern: "^a", options: "i" } })).toEqual({ type: "regex", pattern: "^a", options: "i" });
    expect(bsonValue({ $timestamp: { t: 1, i: 2 } })).toEqual({ type: "timestamp", t: 1, i: 2 });
    expect(bsonValue({ $binary: { base64: "AQ==", subType: "00" } })).toEqual({ type: "binary", base64: "AQ==", subType: "00" });
    expect(bsonValue({ $minKey: 1 }).type).toBe("minKey");
    expect(bsonValue({ $maxKey: 1 }).type).toBe("maxKey");
    expect(bsonValue({ $code: "x", $scope: { a: 1 } })).toEqual({ type: "code", code: "x", scope: { a: 1 } });
  });

  it("accepts relaxed dates and plain JSON numbers", () => {
    expect(bsonValue({ $date: "2024-01-02T10:00:00Z" })).toEqual({ type: "date", ms: Date.UTC(2024, 0, 2, 10) });
    expect(bsonValue(3)).toEqual({ type: "int32", value: 3 });
    expect(bsonValue(2.5)).toEqual({ type: "double", value: "2.5" });
  });

  it("treats a document with other keys beside a $-key as a plain document", () => {
    expect(bsonValue({ $oid: "x", name: "y" }).type).toBe("object");
  });

  it("lists children of documents and arrays", () => {
    expect(childrenOf(bsonValue({ a: 1, b: [2] }))).toEqual([["a", 1], ["b", [2]]]);
    expect(childrenOf(bsonValue(["x", "y"]))).toEqual([["0", "x"], ["1", "y"]]);
    expect(childrenOf(bsonValue("x"))).toEqual([]);
  });
});

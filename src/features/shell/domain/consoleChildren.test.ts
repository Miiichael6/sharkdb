import { describe, expect, it } from "vitest";
import { ARRAY_CHUNK, consoleChildren, rangeItems, rangeLabel } from "./consoleChildren";

describe("consoleChildren", () => {
  it("lists a document's fields and a short array's elements by index", () => {
    expect(consoleChildren({ a: 1, b: { c: 2 } })).toEqual([
      { kind: "field", key: "a", value: 1 },
      { kind: "field", key: "b", value: { c: 2 } },
    ]);
    expect(consoleChildren(["x"])).toEqual([{ kind: "field", key: "0", value: "x" }]);
  });

  it("splits a long array into ranges of ARRAY_CHUNK", () => {
    const items = Array.from({ length: ARRAY_CHUNK * 2 + 5 }, (_, i) => i);
    expect(consoleChildren(items)).toEqual([
      { kind: "range", from: 0, to: 99 },
      { kind: "range", from: 100, to: 199 },
      { kind: "range", from: 200, to: 204 },
    ]);
    expect(rangeItems(items, 200, 204).map((c) => c.kind === "field" && c.key)).toEqual(["200", "201", "202", "203", "204"]);
    expect(rangeLabel(0, 99)).toBe("[0 … 99]");
  });

  it("has nothing below a scalar", () => {
    expect(consoleChildren({ $oid: "5f1d7a3c9b1e8a0012345678" })).toEqual([]);
  });
});

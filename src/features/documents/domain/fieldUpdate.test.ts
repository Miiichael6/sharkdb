import { describe, expect, it } from "vitest";
import { NO_ID } from "./documentEdit";
import { fieldUpdate, withField } from "./fieldUpdate";

const A = { $oid: "65a1b2c3d4e5f6a7b8c9d0e1" };

describe("fieldUpdate", () => {
  it("sets only that field, while it still holds the value that was read", () => {
    expect(fieldUpdate({ _id: A, EECC: { RUC: "1" } }, ["EECC", "RUC"], "1", "2")).toEqual({
      filter: { _id: A, "EECC.RUC": "1" },
      update: { $set: { "EECC.RUC": "2" } },
    });
  });

  it("addresses array elements by index", () => {
    const { filter, update } = fieldUpdate({ _id: A, items: [{ n: { $numberInt: "1" } }] }, ["items", "0", "n"], { $numberInt: "1" }, { $numberInt: "2" });
    expect(filter).toEqual({ _id: A, "items.0.n": { $numberInt: "1" } });
    expect(update).toEqual({ $set: { "items.0.n": { $numberInt: "2" } } });
  });

  it("needs the document's _id", () => {
    expect(() => fieldUpdate({ a: 1 }, ["a"], 1, 2)).toThrow(NO_ID);
  });
});

describe("withField", () => {
  it("copies the document with the field changed, keeping field order and the original untouched", () => {
    const doc = { _id: A, b: { c: "x", d: 1 }, tags: ["a", "b"], z: true };
    const next = withField(doc, ["b", "c"], "y");
    expect(next).toEqual({ _id: A, b: { c: "y", d: 1 }, tags: ["a", "b"], z: true });
    expect(Object.keys(next)).toEqual(["_id", "b", "tags", "z"]);
    expect(doc.b.c).toBe("x");
    expect(next.tags).toBe(doc.tags);
    expect(withField(doc, ["tags", "1"], "c").tags).toEqual(["a", "c"]);
  });
});

import { describe, expect, it } from "vitest";
import type { IndexSpec } from "./mongo";
import { creatableSpec, defaultIndexName, parseJsonObject } from "./indexSpec";

describe("creatableSpec", () => {
  it("drops the server-managed v and ns fields and keeps the rest", () => {
    const spec = { v: 2, ns: "shop.orders", key: { a: 1 }, name: "a_1", unique: true } as IndexSpec;
    expect(creatableSpec(spec)).toEqual({ key: { a: 1 }, name: "a_1", unique: true });
  });
});

describe("defaultIndexName", () => {
  it("follows MongoDB's field_direction naming", () => {
    expect(defaultIndexName({ a: 1, b: -1 })).toBe("a_1_b_-1");
  });
});

describe("parseJsonObject", () => {
  it("accepts a JSON object", () => {
    expect(parseJsonObject('{"a":1}', "Clave")).toEqual({ a: 1 });
  });

  it("rejects arrays and invalid JSON with the field name", () => {
    expect(() => parseJsonObject("[1]", "Clave")).toThrow(/Clave/);
    expect(() => parseJsonObject("{a:", "Clave")).toThrow(/Clave/);
  });
});

import { describe, expect, it } from "vitest";
import type { IndexSpec } from "./mongo";
import { creatableSpec, defaultIndexName, editedSpec, inPlaceIndexChange, parseJsonObject } from "./indexSpec";

describe("creatableSpec", () => {
  it("drops the server-managed v and ns fields and keeps the rest", () => {
    const spec = { v: 2, ns: "shop.orders", key: { a: 1 }, name: "a_1", unique: true } as IndexSpec;
    expect(creatableSpec(spec)).toEqual({ key: { a: 1 }, name: "a_1", unique: true });
  });
});

describe("editedSpec", () => {
  const original = {
    v: 2,
    name: "email_1",
    key: { email: 1 },
    unique: true,
    sparse: true,
    collation: { locale: "es", strength: 2 },
    hidden: true,
  } as IndexSpec;

  it("keeps the options the form doesn't show", () => {
    expect(editedSpec(original, { name: "email_1", key: { email: 1 }, unique: true, sparse: true })).toEqual({
      name: "email_1",
      key: { email: 1 },
      unique: true,
      sparse: true,
      collation: { locale: "es", strength: 2 },
      hidden: true,
    });
  });

  it("drops the form options the user cleared", () => {
    expect(editedSpec(original, { name: "email_1", key: { email: 1 } })).toEqual({
      name: "email_1",
      key: { email: 1 },
      collation: { locale: "es", strength: 2 },
      hidden: true,
    });
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

describe("inPlaceIndexChange", () => {
  const TTL = { v: 2, name: "created_1", key: { created: 1 }, expireAfterSeconds: 3600 } as IndexSpec;
  const change = (next: Partial<IndexSpec>, old: IndexSpec = TTL) =>
    inPlaceIndexChange("events", old, { ...creatableSpec(old), ...next });

  it("changes only the TTL with collMod", () => {
    expect(change({ expireAfterSeconds: 60 })).toEqual({
      collMod: "events",
      index: { name: "created_1", expireAfterSeconds: 60 },
    });
  });

  it("hides and unhides the index with collMod", () => {
    expect(change({ hidden: true })).toEqual({ collMod: "events", index: { name: "created_1", hidden: true } });
    expect(change({ hidden: false }, { ...TTL, hidden: true })).toEqual({
      collMod: "events",
      index: { name: "created_1", hidden: false },
    });
  });

  it("changes the TTL and hidden at once", () => {
    expect(change({ expireAfterSeconds: 60, hidden: true })).toEqual({
      collMod: "events",
      index: { name: "created_1", expireAfterSeconds: 60, hidden: true },
    });
  });

  it("has nothing to change when only build options or false flags differ", () => {
    expect(change({ background: true, unique: false, hidden: false })).toEqual({
      collMod: "events",
      index: { name: "created_1" },
    });
  });

  it("needs a rebuild when other options, the name or the key change", () => {
    expect(change({ expireAfterSeconds: 60, sparse: true })).toBeNull();
    expect(change({ unique: true })).toBeNull();
    expect(change({ name: "by_created" })).toBeNull();
    expect(change({ key: { created: -1 } })).toBeNull();
  });

  it("needs a rebuild to add or remove the TTL", () => {
    const plain = { v: 2, name: "email_1", key: { email: 1 }, unique: true } as IndexSpec;
    expect(change({ expireAfterSeconds: 60 }, plain)).toBeNull();
    expect(inPlaceIndexChange("events", TTL, { name: "created_1", key: { created: 1 } })).toBeNull();
  });
});

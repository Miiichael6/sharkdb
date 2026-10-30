import { describe, expect, it } from "vitest";
import {
  cellText,
  collapseRecursively,
  documentKey,
  documentsOf,
  expandRecursively,
  lookup,
  rowId,
  tableColumns,
  toggleExpanded,
  visibleTreeRows,
} from "./resultView";

const oid = { $oid: "5f1d7a3c9b1e8a0012345678" };
const docs = [
  { _id: oid, name: "Lima", geo: { lat: { $numberDouble: "-12.0" }, lng: 1 }, tags: ["a"] },
  { _id: 2, name: "Cusco" },
];

describe("documentKey", () => {
  it("numbers documents and shows their _id like Robo 3T", () => {
    expect(documentKey(docs[0], 1, "utc")).toBe('(1) ObjectId("5f1d7a3c9b1e8a0012345678")');
    expect(documentKey({ a: 1 }, 7, "utc")).toBe("(7)");
  });
});

describe("visibleTreeRows", () => {
  it("shows an expanded document's fields under it", () => {
    const rows = visibleTreeRows(docs, 1, new Set([rowId(0, [])]), "utc");
    expect(rows.map((r) => [r.depth, r.key, r.value, r.typeLabel])).toEqual([
      [0, '(1) ObjectId("5f1d7a3c9b1e8a0012345678")', "{ 4 fields }", "Object"],
      [1, "_id", 'ObjectId("5f1d7a3c9b1e8a0012345678")', "ObjectId"],
      [1, "name", "Lima", "String"],
      [1, "geo", "{ 2 fields }", "Object"],
      [1, "tags", "[ 1 element ]", "Array"],
      [0, "(2) 2", "{ 2 fields }", "Object"],
    ]);
  });

  it("numbers documents from the page's skip", () => {
    expect(visibleTreeRows(docs, 51, new Set(), "utc").map((r) => r.key)).toEqual([
      '(51) ObjectId("5f1d7a3c9b1e8a0012345678")',
      "(52) 2",
    ]);
  });

  it("opens nested rows with their path", () => {
    const expanded = toggleExpanded(new Set([rowId(0, [])]), rowId(0, ["geo"]));
    const lat = visibleTreeRows(docs, 1, expanded, "utc").find((r) => r.key === "lat")!;
    expect(lat).toMatchObject({ depth: 2, path: ["geo", "lat"], value: "-12.0", typeLabel: "Double", expandable: false });
  });

  it("collapses a row toggled twice", () => {
    const id = rowId(0, []);
    expect(toggleExpanded(toggleExpanded(new Set(), id), id).has(id)).toBe(false);
  });
});

describe("lookup", () => {
  it("finds nested values and array elements", () => {
    expect(lookup(docs[0], ["geo", "lng"])).toEqual({ value: 1 });
    expect(lookup(docs[0], ["tags", "0"])).toEqual({ value: "a" });
    expect(lookup(docs[0], [])).toEqual({ value: docs[0] });
  });

  it("is null for missing keys", () => {
    expect(lookup(docs[1], ["geo", "lat"])).toBeNull();
  });
});

describe("tableColumns", () => {
  it("joins the fields of all documents, spreading embedded documents into dotted columns", () => {
    expect(tableColumns([...docs, { extra: true }]).map((c) => c.label)).toEqual(["_id", "name", "geo.lat", "geo.lng", "tags", "extra"]);
  });

  it("keeps BSON values like ObjectId as one column", () => {
    expect(tableColumns([{ ref: oid }]).map((c) => c.label)).toEqual(["ref"]);
  });
});

describe("documentsOf", () => {
  it("shows documents and arrays of documents as documents", () => {
    expect(documentsOf({ acknowledged: true })).toEqual([{ acknowledged: true }]);
    expect(documentsOf([{ a: 1 }, { a: 2 }])).toHaveLength(2);
  });

  it("leaves scalars and mixed arrays as plain values", () => {
    expect(documentsOf({ $numberLong: "5" })).toBeNull();
    expect(documentsOf([1, { a: 1 }])).toBeNull();
    expect(documentsOf([])).toBeNull();
  });
});

describe("cellText", () => {
  const rows = visibleTreeRows(docs, 1, new Set([rowId(0, [])]), "utc");
  const row = (key: string) => rows.find((r) => r.key === key)!;

  it("copies the field name, the type name, or the whole document from its own row", () => {
    expect(cellText(row("name"), "key", docs[0], "utc")).toBe("name");
    expect(cellText(row("_id"), "type", docs[0], "utc")).toBe("ObjectId");
    expect(cellText(rows[0], "key", docs[0], "utc")).toContain('"name" : "Lima"');
  });

  it("copies strings as plain text and other values in shell syntax", () => {
    expect(cellText(row("name"), "value", docs[0], "utc")).toBe("Lima");
    expect(cellText(row("_id"), "value", docs[0], "utc")).toBe('ObjectId("5f1d7a3c9b1e8a0012345678")');
    expect(cellText(row("tags"), "value", docs[0], "utc")).toContain('"a"');
  });
});

describe("expand / collapse recursively", () => {
  const doc = { a: { b: { c: 1 }, empty: {} }, list: [{ x: 1 }], n: 1 };

  it("opens every non-empty container below the row", () => {
    const open = expandRecursively(new Set(), doc, 0, []);
    expect([...open].sort()).toEqual(
      [rowId(0, []), rowId(0, ["a"]), rowId(0, ["a", "b"]), rowId(0, ["list"]), rowId(0, ["list", "0"])].sort(),
    );
    expect(expandRecursively(new Set(), doc.a, 0, ["a"]).has(rowId(0, []))).toBe(false);
  });

  it("closes the row and its descendants only", () => {
    const open = new Set([rowId(0, []), rowId(0, ["a"]), rowId(0, ["a", "b"]), rowId(1, ["a"])]);
    expect([...collapseRecursively(open, 0, ["a"])]).toEqual([rowId(0, []), rowId(1, ["a"])]);
  });
});

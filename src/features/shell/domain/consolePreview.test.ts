import { describe, expect, it } from "vitest";
import { MAX_PREVIEW_CHARS, previewParts, topLevelText, valuePreview } from "./consolePreview";

const oid = { $oid: "5f1d7a3c9b1e8a0012345678" };

describe("valuePreview", () => {
  it("shows arrays with their length and nested containers by their shape", () => {
    expect(valuePreview([1, "a", { x: 1 }, [1, 2], {}], "utc")).toBe('Array(5) [1, "a", {…}, Array(2), {}]');
  });

  it("shows documents one level deep with EJSON wrappers as shell literals", () => {
    const doc = { _id: oid, name: "Lima", geo: { lat: 1 }, tags: ["a"], n: { $numberLong: "5" } };
    expect(valuePreview(doc, "utc")).toBe('{_id: ObjectId("5f1d7a3c9b1e8a0012345678"), name: "Lima", geo: {…}, tags: Array(1), n: NumberLong(5)}');
  });

  it("writes empty containers as such", () => {
    expect(valuePreview([], "utc")).toBe("Array(0) []");
    expect(valuePreview({}, "utc")).toBe("{}");
  });

  it("cuts long previews with an ellipsis before the closing bracket", () => {
    const text = valuePreview(Array.from({ length: 200 }, (_, i) => i), "utc");
    expect(text.startsWith("Array(200) [0, 1, 2")).toBe(true);
    expect(text.endsWith(", …]")).toBe(true);
    expect(text.length).toBeLessThanOrEqual("Array(200) [".length + MAX_PREVIEW_CHARS + ", …]".length);
  });

  it("cuts a first part that alone is too long", () => {
    expect(valuePreview({ a: "x".repeat(MAX_PREVIEW_CHARS) }, "utc")).toBe("{…}");
  });

  it("adds the class label and marks arrays with more to read", () => {
    expect(valuePreview({ acknowledged: true }, "utc", { label: "WriteResult" })).toBe("WriteResult {acknowledged: true}");
    expect(valuePreview([{ a: 1 }], "utc", { more: true })).toBe("Array(1+) [{…}]");
  });
});

describe("topLevelText", () => {
  it("writes numbers like JavaScript, not as doubles", () => {
    expect(topLevelText({ $numberDouble: "120.0" }, "utc")).toBe("120");
    expect(topLevelText(120, "utc")).toBe("120");
    expect(topLevelText({ $numberDouble: "1.5" }, "utc")).toBe("1.5");
  });

  it("writes strings without quotes and wrappers as shell literals", () => {
    expect(topLevelText("test.coleccion", "utc")).toBe("test.coleccion");
    expect(topLevelText(oid, "utc")).toBe('ObjectId("5f1d7a3c9b1e8a0012345678")');
    expect(topLevelText(null, "utc")).toBe("null");
  });
});

describe("previewParts", () => {
  it("tags each piece with what colors it", () => {
    expect(previewParts({ a: null, b: [1] }, "utc", { label: "WriteResult" })).toEqual([
      { text: "WriteResult", tone: "label" },
      { text: " ", tone: null },
      { text: "{", tone: null },
      { text: "a", tone: "key" },
      { text: ": ", tone: null },
      { text: "null", tone: "null" },
      { text: ", ", tone: null },
      { text: "b", tone: "key" },
      { text: ": ", tone: null },
      { text: "Array(1)", tone: "array" },
      { text: "}", tone: null },
    ]);
  });
});

describe("console numbers", () => {
  it("writes JS numbers inside a preview without .0", () => {
    expect(valuePreview({ n: { $numberDouble: "5.0" }, f: { $numberDouble: "1.5" } }, "utc")).toBe("{n: 5, f: 1.5}");
  });
});

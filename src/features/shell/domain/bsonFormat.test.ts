import { describe, expect, it } from "vitest";
import { doubleText, formatEditable, formatValue, isoDate, summarizeValue } from "./bsonFormat";

const oid = { $oid: "5f1d7a3c9b1e8a0012345678" };
const date = { $date: { $numberLong: String(Date.UTC(2024, 0, 2, 10, 30)) } };

describe("formatValue", () => {
  it("writes BSON types with shell syntax", () => {
    expect(formatValue(oid, "utc")).toBe('ObjectId("5f1d7a3c9b1e8a0012345678")');
    expect(formatValue(date, "utc")).toBe('ISODate("2024-01-02T10:30:00.000Z")');
    expect(formatValue({ $numberLong: "42" }, "utc")).toBe("NumberLong(42)");
    expect(formatValue({ $numberLong: "9007199254740993" }, "utc")).toBe('NumberLong("9007199254740993")');
    expect(formatValue({ $numberInt: "7" }, "utc")).toBe("7");
    expect(formatValue({ $numberDouble: "5.0" }, "utc")).toBe("5.0");
    expect(formatValue({ $numberDecimal: "0.1" }, "utc")).toBe('NumberDecimal("0.1")');
    expect(formatValue({ $regularExpression: { pattern: "^a", options: "i" } }, "utc")).toBe("/^a/i");
    expect(formatValue({ $timestamp: { t: 1, i: 2 } }, "utc")).toBe("Timestamp(1, 2)");
    expect(formatValue({ $minKey: 1 }, "utc")).toBe("MinKey()");
    expect(formatValue("a\"b", "utc")).toBe('"a\\"b"');
  });

  it("writes UUIDs and other binaries", () => {
    const uuid = { $binary: { base64: "ASNFZ4mrze8BI0VniavN7w==", subType: "04" } };
    expect(formatValue(uuid, "utc")).toBe('UUID("01234567-89ab-cdef-0123-456789abcdef")');
    expect(formatValue({ $binary: { base64: "AQ==", subType: "00" } }, "utc")).toBe('BinData(0,"AQ==")');
  });

  it("indents documents and arrays", () => {
    expect(formatValue({ _id: oid, tags: ["a", "b"], empty: {} }, "utc")).toBe(
      [
        "{",
        '    "_id" : ObjectId("5f1d7a3c9b1e8a0012345678"),',
        '    "tags" : [ ',
        '        "a", ',
        '        "b"',
        "    ],",
        '    "empty" : {}',
        "}",
      ].join("\n"),
    );
  });
});

describe("formatEditable", () => {
  it("writes Int32 as plain integers and doubles with a decimal point, as Robo 3T, and dates in UTC", () => {
    expect(formatEditable({ n: { $numberInt: "7" }, d: { $numberDouble: "7.0" }, at: date })).toBe(
      '{\n    "n" : 7,\n    "d" : 7.0,\n    "at" : ISODate("2024-01-02T10:30:00.000Z")\n}',
    );
  });
});

describe("summarizeValue", () => {
  it("counts fields and elements", () => {
    expect(summarizeValue({ a: 1, b: 2 }, "utc")).toBe("{ 2 fields }");
    expect(summarizeValue({ a: 1 }, "utc")).toBe("{ 1 field }");
    expect(summarizeValue([1, 2, 3], "utc")).toBe("[ 3 elements ]");
  });

  it("shows strings unquoted and dates readable", () => {
    expect(summarizeValue("hola", "utc")).toBe("hola");
    expect(summarizeValue(date, "utc")).toBe("2024-01-02 10:30:00.000Z");
  });
});

describe("isoDate", () => {
  it("writes local dates with their offset, pointing to the same instant", () => {
    const ms = Date.UTC(2024, 6, 15, 23, 5, 9, 7);
    const local = isoDate(ms, "local");
    expect(local).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d$/);
    expect(Date.parse(local)).toBe(ms);
  });

  it("marks out-of-range dates", () => {
    expect(isoDate(9e15, "utc")).toBe("Invalid Date");
  });
});

describe("doubleText", () => {
  it("adds a decimal part to whole doubles only", () => {
    expect(doubleText("3")).toBe("3.0");
    expect(doubleText("3.25")).toBe("3.25");
    expect(doubleText("1e+21")).toBe("1e+21");
    expect(doubleText("Infinity")).toBe("Infinity");
  });
});

describe("copying a document", () => {
  const doc = { _id: oid, ID: { $numberDouble: "1768481775497" }, month: { $numberInt: "1" }, days: [{ date }, { date }] };

  it("writes dates in the zone chosen in the view", () => {
    expect(formatValue(doc, "local")).toContain(`ISODate("${isoDate(Date.UTC(2024, 0, 2, 10, 30), "local")}")`);
  });

  it("copies as Robo 3T does: shell syntax", () => {
    expect(formatValue(doc, "utc")).toBe(
      [
        "{",
        '    "_id" : ObjectId("5f1d7a3c9b1e8a0012345678"),',
        '    "ID" : 1768481775497.0,',
        '    "month" : 1,',
        '    "days" : [ ',
        "        {",
        '            "date" : ISODate("2024-01-02T10:30:00.000Z")',
        "        }, ",
        "        {",
        '            "date" : ISODate("2024-01-02T10:30:00.000Z")',
        "        }",
        "    ]",
        "}",
      ].join("\n"),
    );
  });
});

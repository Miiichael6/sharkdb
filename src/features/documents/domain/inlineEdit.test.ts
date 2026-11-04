import { describe, expect, it } from "vitest";
import { inlineDisplayText, inlineEditText, isInlineEditable, isSameValue, parseInlineValue } from "./inlineEdit";

const int = (n: string) => ({ $numberInt: n });
const long = (n: string) => ({ $numberLong: n });
const double = (n: string) => ({ $numberDouble: n });
const decimal = (n: string) => ({ $numberDecimal: n });

describe("isInlineEditable", () => {
  it("accepts strings, numbers and booleans, also inside sub-documents and arrays", () => {
    for (const raw of ["x", "", int("1"), long("1"), double("1.5"), decimal("0.1"), true, 7, 1.5]) {
      expect(isInlineEditable(["a"], raw)).toBe(true);
    }
    expect(isInlineEditable(["EECC", "RUC"], "20100"), "nested").toBe(true);
    expect(isInlineEditable(["tags", "0"], "red"), "array element").toBe(true);
  });

  it("refuses null, dates, ObjectId, containers, the document itself and the _id", () => {
    for (const raw of [null, { $date: { $numberLong: "0" } }, { $oid: "65a1b2c3d4e5f6a7b8c9d0e1" }, { a: 1 }, [1]]) {
      expect(isInlineEditable(["a"], raw)).toBe(false);
    }
    expect(isInlineEditable([], "x")).toBe(false);
    expect(isInlineEditable(["_id"], int("1"))).toBe(false);
    expect(isInlineEditable(["_id", "part"], "x")).toBe(false);
  });

  it("refuses keys a dotted path can't name", () => {
    expect(isInlineEditable(["a.b"], "x")).toBe(false);
    expect(isInlineEditable(["a", "$c"], "x")).toBe(false);
    expect(isInlineEditable(["a", ""], "x"), "empty key").toBe(false);
  });

  it("refuses strings of several lines: a one-line field would drop the line breaks", () => {
    expect(isInlineEditable(["a"], "uno\ndos")).toBe(false);
    expect(isInlineEditable(["a"], "uno\r\ndos")).toBe(false);
    expect(isInlineEditable(["a"], "uno\tdos")).toBe(true);
  });
});

describe("inlineEditText / inlineDisplayText", () => {
  it("edit strings without quotes and numbers as plain numbers", () => {
    expect(inlineEditText("hola ")).toBe("hola ");
    expect(inlineEditText(int("5"))).toBe("5");
    expect(inlineEditText(long("9007199254740993"))).toBe("9007199254740993");
    expect(inlineEditText(double("5"))).toBe("5.0");
    expect(inlineEditText(decimal("1.50"))).toBe("1.50");
    expect(inlineEditText(false)).toBe("false");
  });

  it("show strings quoted in the confirmation, so empty and trailing spaces are visible", () => {
    expect(inlineDisplayText("")).toBe('""');
    expect(inlineDisplayText("a ")).toBe('"a "');
    expect(inlineDisplayText(int("5"))).toBe("5");
    expect(inlineDisplayText(true)).toBe("true");
  });
});

describe("parseInlineValue", () => {
  it("keeps the original type", () => {
    expect(parseInlineValue("123", "abc")).toEqual({ value: "123", error: null });
    expect(parseInlineValue(" 42 ", int("1")).value).toEqual(int("42"));
    expect(parseInlineValue("9007199254740993", long("1")).value).toEqual(long("9007199254740993"));
    expect(parseInlineValue("NumberLong(7)", long("1")).value).toEqual(long("7"));
    expect(parseInlineValue("7", double("1.5")).value).toEqual(double("7.0"));
    expect(parseInlineValue("2.25", double("1.5")).value).toEqual(double("2.25"));
    expect(parseInlineValue('NumberDecimal("0.30")', decimal("0.1")).value).toEqual(decimal("0.30"));
    expect(parseInlineValue("false", true).value).toBe(false);
  });

  it("refuses text of another type with a readable reason", () => {
    expect(parseInlineValue("abc", int("1")).error).toBe("Se esperaba un Int32");
    expect(parseInlineValue("1.5", int("1")).error).toMatch(/sin decimales/);
    expect(parseInlineValue("2147483648", int("1")).error).toMatch(/Fuera del rango de Int32/);
    expect(parseInlineValue("9223372036854775808", long("1")).error).toMatch(/Fuera del rango de Int64/);
    expect(parseInlineValue("1e400", double("1.5")).error).toMatch(/Fuera del rango/);
    expect(parseInlineValue("NumberLong(1)", int("1")).error).toBe("Se esperaba un Int32");
    expect(parseInlineValue("yes", true).error).toMatch(/true o false/);
    expect(parseInlineValue("", decimal("1")).error).toBe("Se esperaba un Decimal128");
  });

  it("never opens a type that isn't edited in place", () => {
    expect(() => parseInlineValue("x", null)).toThrow(/no se edita en línea/);
  });
});

describe("isSameValue", () => {
  it("compares type and value, not text", () => {
    expect(isSameValue(double("5"), double("5.0"))).toBe(true);
    expect(isSameValue(5, int("5")), "relaxed and canonical Int32").toBe(true);
    expect(isSameValue(long("10"), long("010"))).toBe(true);
    expect(isSameValue(decimal("1.50"), decimal("1.5"))).toBe(true);
    expect(isSameValue(decimal("15E-1"), decimal("1.5"))).toBe(true);
    expect(isSameValue(double("NaN"), double("NaN"))).toBe(true);
    expect(isSameValue("a", "a")).toBe(true);
  });

  it("tells changed values and types apart", () => {
    expect(isSameValue("a", "a ")).toBe(false);
    expect(isSameValue(int("5"), double("5.0"))).toBe(false);
    expect(isSameValue(decimal("1.5"), decimal("1.51"))).toBe(false);
    expect(isSameValue(true, false)).toBe(false);
  });
});

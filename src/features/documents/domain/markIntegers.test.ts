import { describe, expect, it } from "vitest";
import { markIntegers } from "./markIntegers";

describe("markIntegers", () => {
  it("marks integer values of objects and arrays as Int32", () => {
    expect(markIntegers('{ "a" : 1, "b" : -2, "c" : [3, 4], "d" : { "e" : 0 } }')).toBe(
      '{ "a" : NumberInt(1), "b" : NumberInt(-2), "c" : [NumberInt(3), NumberInt(4)], "d" : { "e" : NumberInt(0) } }',
    );
  });

  it("leaves doubles, out-of-range integers and other number forms alone", () => {
    const text = '{ "a" : 2.0, "b" : 1e3, "c" : 2147483648, "d" : 0x1F, "e" : 007, "f" : -2147483649 }';
    expect(markIntegers(text)).toBe(text);
    expect(markIntegers('{ "a" : 2147483647 }')).toBe('{ "a" : NumberInt(2147483647) }');
  });

  it("leaves call arguments, keys, strings, regexes and comments alone", () => {
    const text = [
      "{",
      '    "_id" : ObjectId("5d517d5d8e324a93b247633b"),',
      '    "n" : NumberLong(5), "d" : Decimal128("1"), 3 : "x",',
      '    "s" : "a: 1, [2]", "t" : \'b: 3\', "r" : /x: 4, [5]/i,',
      '    // "c" : 6',
      '    /* "c" : 7 */ "u" : `v: 8`',
      "}",
    ].join("\n");
    expect(markIntegers(text)).toBe(text);
  });

  it("marks values that follow a string containing brackets", () => {
    expect(markIntegers('{ "a" : "{[(", "b" : 1 }')).toBe('{ "a" : "{[(", "b" : NumberInt(1) }');
  });
});

import { describe, expect, it } from "vitest";
import { markNumbers } from "./markNumbers";

describe("markNumbers", () => {
  it("marks integer values of objects and arrays as Int32", () => {
    expect(markNumbers('{ "a" : 1, "b" : -2, "c" : [3, 4], "d" : { "e" : 0 } }')).toBe(
      '{ "a" : NumberInt(1), "b" : NumberInt(-2), "c" : [NumberInt(3), NumberInt(4)], "d" : { "e" : NumberInt(0) } }',
    );
  });

  it("marks integral decimals as Double, so they don't become Int32", () => {
    expect(markNumbers('{ "a" : 2.0, "b" : -0.0, "c" : [1e3, 5.0e-1], "d" : 1E+21, "e" : 1.5 }')).toBe(
      '{ "a" : Double(2.0), "b" : Double(-0.0), "c" : [Double(1e3), 5.0e-1], "d" : Double(1E+21), "e" : 1.5 }',
    );
  });

  it("leaves non-integral decimals, out-of-range integers and other number forms alone", () => {
    const text = '{ "a" : 2.5, "b" : 1e-3, "c" : 2147483648, "d" : 0x1F, "e" : 007, "f" : -2147483649 }';
    expect(markNumbers(text)).toBe(text);
    expect(markNumbers('{ "a" : 2147483647 }')).toBe('{ "a" : NumberInt(2147483647) }');
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
    expect(markNumbers(text)).toBe(text);
  });

  it("marks values that follow a string containing brackets", () => {
    expect(markNumbers('{ "a" : "{[(", "b" : 1 }')).toBe('{ "a" : "{[(", "b" : NumberInt(1) }');
  });
});

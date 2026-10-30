import { describe, expect, it } from "vitest";
import { parseHistory, pushHistory, stepHistory, type HistoryEntry } from "./history";

const run = (code: string, at = 1): HistoryEntry => ({ code, db: "test", at });

describe("history", () => {
  it("puts the newest run first, trimmed", () => {
    expect(pushHistory([run("a")], run("  b\n"))).toEqual([run("b"), run("a")]);
  });

  it("skips blank code and consecutive repeats", () => {
    const h = [run("a", 1)];
    expect(pushHistory(h, run("   "))).toBe(h);
    expect(pushHistory(h, run("a", 2))).toEqual([run("a", 2)]);
  });

  it("keeps non-consecutive repeats and drops the oldest past the limit", () => {
    const h = pushHistory(pushHistory([run("a")], run("b")), run("a"), 2);
    expect(h.map((e) => e.code)).toEqual(["a", "b"]);
  });

  it("steps through entries within bounds", () => {
    expect(stepHistory(3, -1, "older")).toBe(0);
    expect(stepHistory(3, 2, "older")).toBe(2);
    expect(stepHistory(3, 0, "newer")).toBe(-1);
    expect(stepHistory(3, -1, "newer")).toBe(-1);
    expect(stepHistory(0, -1, "older")).toBe(-1);
  });

  it("parses only well-formed stored entries", () => {
    expect(parseHistory([run("a"), { code: 1 }, null, "x"])).toEqual([run("a")]);
    expect(parseHistory({})).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { formatCost, formatDuration, prettyJson } from "./format";

describe("format", () => {
  it("durations in ms or seconds, pending while running", () => {
    expect(formatDuration(null)).toBe("…");
    expect(formatDuration(42)).toBe("42 ms");
    expect(formatDuration(1530)).toBe("1.5 s");
  });

  it("costs keep the decimals that matter", () => {
    expect(formatCost(0.0042)).toBe("$0.004");
    expect(formatCost(0.256)).toBe("$0.26");
  });

  it("missing JSON reads as an empty object", () => {
    expect(prettyJson(undefined)).toBe("{}");
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
  });
});

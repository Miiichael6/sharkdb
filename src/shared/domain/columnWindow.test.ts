import { describe, expect, it } from "vitest";
import { columnWindow } from "./columnWindow";

const widths = [100, 100, 100, 100, 100];

describe("columnWindow", () => {
  it("draws only the columns in the strip and pads the rest", () => {
    // Columns start after a 50px number column: 50–150, 150–250, 250–350…
    expect(columnWindow(widths, 50, 160, 100)).toEqual({ first: 1, end: 3, before: 100, after: 200 });
  });

  it("draws everything when the strip covers the whole row", () => {
    expect(columnWindow(widths, 0, 0, 1000)).toEqual({ first: 0, end: 5, before: 0, after: 0 });
  });

  it("starts at the first column at the left edge", () => {
    expect(columnWindow(widths, 50, 0, 120)).toEqual({ first: 0, end: 1, before: 0, after: 400 });
  });

  it("draws nothing past the last column", () => {
    expect(columnWindow(widths, 0, 900, 100)).toEqual({ first: 5, end: 5, before: 0, after: 0 });
  });

  it("handles no columns", () => {
    expect(columnWindow([], 0, 0, 500)).toEqual({ first: 0, end: 0, before: 0, after: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { CHECKING, checked, checkFailed, downloading, IDLE, isBusy, percentOf } from "./update";

describe("update", () => {
  it("a check finds a newer version or none", () => {
    expect(checked({ version: "0.2.0", notes: "Novedades" })).toEqual({
      kind: "available",
      version: "0.2.0",
      notes: "Novedades",
    });
    expect(checked(null)).toEqual({ kind: "upToDate" });
  });

  it("a failed check shows its error only when the user asked for it", () => {
    expect(checkFailed("sin red", false)).toEqual({ kind: "error", message: "sin red" });
    expect(checkFailed("sin red", true)).toEqual(IDLE);
  });

  it("measures the download in whole percents, unknown without a size", () => {
    expect(percentOf(0, 200)).toBe(0);
    expect(percentOf(99, 200)).toBe(49);
    expect(percentOf(250, 200)).toBe(100);
    expect(percentOf(50, undefined)).toBeNull();
    expect(percentOf(50, 0)).toBeNull();
    expect(downloading("0.2.0", 100, 200)).toEqual({ kind: "downloading", version: "0.2.0", percent: 50 });
  });

  it("is busy only while checking or downloading", () => {
    expect(isBusy(CHECKING)).toBe(true);
    expect(isBusy(downloading("0.2.0", 0, undefined))).toBe(true);
    expect(isBusy(IDLE)).toBe(false);
    expect(isBusy(checked(null))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { compareVersions, unseenNotes, type ReleaseNote } from "./releaseNotes";

const note = (version: string): ReleaseNote => ({ version, date: "2026-01-01", changes: [] });
const NOTES = [note("0.2.0"), note("0.1.10"), note("0.1.9"), note("0.1.8")];
const versions = (list: ReleaseNote[]) => list.map((n) => n.version);

describe("compareVersions", () => {
  it("compara por número, no por texto", () => {
    expect(compareVersions("0.1.10", "0.1.9")).toBeGreaterThan(0);
    expect(compareVersions("0.1.9", "0.2.0")).toBeLessThan(0);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
  });
});

describe("unseenNotes", () => {
  it("muestra las versiones saltadas hasta la actual", () => {
    expect(versions(unseenNotes("0.1.10", "0.1.8", NOTES))).toEqual(["0.1.10", "0.1.9"]);
  });

  it("nada si ya vio la versión actual o es anterior", () => {
    expect(unseenNotes("0.1.9", "0.1.9", NOTES)).toEqual([]);
    expect(unseenNotes("0.1.9", "0.2.0", NOTES)).toEqual([]);
  });

  it("sin versión vista, solo la actual", () => {
    expect(versions(unseenNotes("0.1.9", null, NOTES))).toEqual(["0.1.9"]);
  });

  it("nada si la versión actual no tiene notas", () => {
    expect(unseenNotes("0.3.0", "0.1.8", NOTES)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { exposable, exposedOf, sameExposure, withExposure } from "./exposure";

const open = [
  { id: "a", name: "Local", safeMode: false },
  { id: "b", name: "Prod", safeMode: true },
];

describe("exposure", () => {
  it("exposes every open connection but the unchecked ones", () => {
    const list = exposable(open, ["b", "gone"]);
    expect(list.map((c) => c.exposed)).toEqual([true, false]);
    expect(exposedOf(list)).toEqual([{ id: "a", name: "Local" }]);
  });

  it("checking and unchecking keep the list without repeats", () => {
    expect(withExposure([], "a", false)).toEqual(["a"]);
    expect(withExposure(["a"], "a", false)).toEqual(["a"]);
    expect(withExposure(["a", "b"], "a", true)).toEqual(["b"]);
  });

  it("compares what the server was told", () => {
    expect(sameExposure([{ id: "a", name: "Local" }], [{ id: "a", name: "Local" }])).toBe(true);
    expect(sameExposure([{ id: "a", name: "Local" }], [{ id: "a", name: "Otra" }])).toBe(false);
    expect(sameExposure([], [{ id: "a", name: "Local" }])).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { favoritesFirst } from "./favoritesFirst";

describe("favoritesFirst", () => {
  it("puts the favorites first and the rest below, each group alphabetical", () => {
    expect(["shop", "logs", "admin", "crm"].sort(favoritesFirst(["shop", "crm"]))).toEqual(["crm", "shop", "admin", "logs"]);
  });

  it("is plain alphabetical without favorites", () => {
    expect(["b", "c", "a"].sort(favoritesFirst([]))).toEqual(["a", "b", "c"]);
  });
});

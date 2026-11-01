import { describe, expect, it } from "vitest";
import {
  FILTER_MIN_COLLECTIONS,
  filterCollections,
  isFilterActive,
  labelSegments,
  matchName,
  showsFilter,
} from "./collectionFilter";
import { childNode, serverNode, withSystemFolder, type TreeNode } from "./tree";

const folder = childNode(serverNode("s", "local"), "collections", "Collections", { db: "shop" });
const collections = (names: string[]): TreeNode[] =>
  withSystemFolder(folder, "systemCollections", names, (n) => n.startsWith("system."), (p, n) =>
    childNode(p, "collection", n, { coll: n }),
  );

describe("matchName", () => {
  it("ignores case and accents in both the name and the query", () => {
    expect(matchName("Configuración", "CONFIGURACION")).toEqual([{ start: 0, end: 13 }]);
    expect(matchName("configuracion", "Configuración")).toEqual([{ start: 0, end: 13 }]);
  });

  it("needs every word, in any order", () => {
    const name = "ALEMANIA_AL02_Preliquidacion";
    expect(matchName(name, "pre al02")).toEqual([
      { start: 9, end: 13 },
      { start: 14, end: 17 },
    ]);
    expect(matchName(name, "al02 peru")).toBeNull();
  });

  it("merges overlapping words into one range", () => {
    expect(matchName("ordenes", "orden den")).toEqual([{ start: 0, end: 5 }]);
  });

  it("matches everything with an empty or blank query", () => {
    expect(matchName("orders", "   ")).toEqual([]);
    expect(isFilterActive("   ")).toBe(false);
    expect(isFilterActive(" a ")).toBe(true);
  });
});

describe("labelSegments", () => {
  it("cuts the label into plain and highlighted pieces", () => {
    expect(labelSegments("ALEMANIA_AL02_Pre", [{ start: 9, end: 13 }])).toEqual([
      { text: "ALEMANIA_", match: false },
      { text: "AL02", match: true },
      { text: "_Pre", match: false },
    ]);
  });

  it("returns the whole label when nothing matches", () => {
    expect(labelSegments("orders", [])).toEqual([{ text: "orders", match: false }]);
  });
});

describe("filterCollections", () => {
  const kids = collections(["orders", "Órdenes_viejas", "users", "system.views"]);

  it("keeps every child, the System folder included, without a query", () => {
    expect(filterCollections(kids, "")).toBe(kids);
  });

  it("keeps only the matching collections and hides the System folder", () => {
    expect(filterCollections(kids, "orde").map((n) => n.label)).toEqual(["orders", "Órdenes_viejas"]);
  });
});

describe("showsFilter", () => {
  const names = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);

  it("shows the box from FILTER_MIN_COLLECTIONS collections on", () => {
    expect(showsFilter(collections(names(FILTER_MIN_COLLECTIONS - 1)))).toBe(false);
    expect(showsFilter(collections(names(FILTER_MIN_COLLECTIONS)))).toBe(true);
  });

  it("counts the collections inside the System folder", () => {
    const kids = collections([...names(FILTER_MIN_COLLECTIONS - 1), "system.views"]);
    expect(showsFilter(kids)).toBe(true);
  });
});

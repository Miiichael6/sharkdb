import { describe, expect, it } from "vitest";
import {
  catalogFavoritesFirst,
  COLLECTIONS_REQUIRED,
  databaseState,
  filterCollections,
  initiallyExpanded,
  originSelection,
  requireCollections,
  selectEverything,
  selectionOf,
  toggleCollection,
  toggleDatabase,
  type DatabaseCatalog,
} from "./selection";

const SHOP: DatabaseCatalog = { name: "shop", sizeOnDisk: 0, collections: ["orders", "users", "carts"] };
const LOG: DatabaseCatalog = { name: "log", sizeOnDisk: 0, collections: ["events"] };
const EMPTY: DatabaseCatalog = { name: "empty", sizeOnDisk: 0, collections: [] };
const CATALOG = [LOG, SHOP, EMPTY];

describe("selection", () => {
  it("checks a whole database or clears it", () => {
    const whole = toggleDatabase({}, SHOP);
    expect(whole).toEqual({ shop: ["orders", "users", "carts"] });
    expect(databaseState(whole, SHOP)).toBe("complete");
    expect(toggleDatabase(whole, SHOP)).toEqual({});
    // A partly chosen database becomes complete.
    expect(toggleDatabase({ shop: ["users"] }, SHOP)).toEqual(whole);
  });

  it("chooses single collections in the catalog's order", () => {
    let selection = toggleCollection({}, SHOP, "carts");
    selection = toggleCollection(selection, SHOP, "orders");
    expect(selection).toEqual({ shop: ["orders", "carts"] });
    expect(databaseState(selection, SHOP)).toBe("partial");
    expect(databaseState(selection, LOG)).toBe("none");
    expect(toggleCollection(toggleCollection(selection, SHOP, "orders"), SHOP, "carts")).toEqual({});
  });

  it("chooses every database whole, skipping empty ones", () => {
    expect(selectEverything(CATALOG)).toEqual({ log: ["events"], shop: ["orders", "users", "carts"] });
  });

  it("starts with what the window was opened on", () => {
    expect(originSelection(CATALOG, "shop", "users")).toEqual({ shop: ["users"] });
    expect(originSelection(CATALOG, "shop")).toEqual({ shop: SHOP.collections });
    expect(originSelection(CATALOG, "shop", "missing")).toEqual({});
    expect(originSelection(CATALOG, "missing")).toEqual({});
    expect(originSelection(CATALOG)).toEqual({});
  });

  it("filters collections by name, ignoring case", () => {
    expect(filterCollections(SHOP.collections, " US ")).toEqual(["users"]);
    expect(filterCollections(SHOP.collections, "")).toEqual(SHOP.collections);
  });

  it("chooses again what a request had, to go back to the selection", () => {
    expect(selectionOf([{ db: "shop", collections: ["orders"] }, { db: "log", collections: [] }])).toEqual({ shop: ["orders"] });
  });

  it("expands what was chosen before, or the database of the origin collection", () => {
    expect(initiallyExpanded([{ db: "shop", collections: ["orders"] }], { db: "log", collection: "events" })).toEqual(["shop"]);
    expect(initiallyExpanded(undefined, { db: "log", collection: "events" })).toEqual(["log"]);
    expect(initiallyExpanded(undefined, { db: "log" })).toEqual([]);
  });

  it("needs at least one collection", () => {
    expect(() => requireCollections([])).toThrow(COLLECTIONS_REQUIRED);
    expect(() => requireCollections([{ db: "shop", collections: [] }])).toThrow(COLLECTIONS_REQUIRED);
    expect(() => requireCollections([{ db: "shop", collections: ["orders"] }])).not.toThrow();
  });
});

describe("catalogFavoritesFirst", () => {
  it("lists the favorites first without hiding the rest", () => {
    const catalog = ["shop", "logs", "crm"].map((name) => ({ name, sizeOnDisk: 0, collections: [] }));
    expect(catalogFavoritesFirst(catalog, ["shop", "gone"]).map((d) => d.name)).toEqual(["shop", "crm", "logs"]);
  });
});

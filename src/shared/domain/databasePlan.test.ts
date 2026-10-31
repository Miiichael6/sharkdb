import { describe, expect, it } from "vitest";
import { databaseDetail, databasePlan, planItems, planLabel, planSelections, replacePlan } from "./databasePlan";
import type { DatabaseCatalog } from "./selection";

const SHOP: DatabaseCatalog = { name: "shop", sizeOnDisk: 0, collections: ["orders", "users", "carts"] };
const LOG: DatabaseCatalog = { name: "log", sizeOnDisk: 0, collections: ["events"] };
const CATALOG = [LOG, SHOP];

describe("databasePlan", () => {
  it("replaces the databases the destination has and creates the others", () => {
    const plan = replacePlan(CATALOG, { shop: ["orders"], log: ["events"] }, ["shop"]);
    expect(plan).toEqual([
      { db: "log", collections: ["events"], complete: true, action: "create" },
      { db: "shop", collections: ["orders"], complete: false, action: "replace" },
    ]);
    expect(planLabel(plan)).toBe("2 bases de datos · 2 colecciones");
    expect(planSelections(plan)).toEqual([
      { db: "log", collections: ["events"] },
      { db: "shop", collections: ["orders"] },
    ]);
  });

  it("describes each database for the confirmation window", () => {
    const plan = databasePlan(CATALOG, { shop: ["orders"], log: ["events"] }, () => "save");
    expect(planItems(plan)).toEqual([
      { badge: "guarda", kind: "save", name: "log", detail: "completa · 1 colección" },
      { badge: "guarda", kind: "save", name: "shop", detail: "orders" },
    ]);
  });

  it("lists a few chosen collections by name and counts the rest", () => {
    const collections = ["a", "b", "c", "d", "e", "f"];
    expect(databaseDetail({ db: "x", collections, complete: false, action: "create" })).toBe("a, b, c, d y 2 más");
  });
});

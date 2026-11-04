import { describe, expect, it } from "vitest";
import { byDatabase, plannedCollections } from "../../shared/domain/collectionProgress";
import { filterGroups } from "./detailFilter";

const GROUPS = byDatabase(
  plannedCollections([
    { db: "ventas", collections: ["clientes", "pedidos", "facturas"] },
    { db: "inventario", collections: ["productos", "almacén"] },
  ]),
);

const shownNames = (query: string) =>
  filterGroups(GROUPS, query).map(({ group, shown }) => `${group.db}: ${shown.map((c) => c.collection).join(",")}`);

describe("filterGroups", () => {
  it("shows everything without a query", () => {
    expect(shownNames("  ")).toEqual(["ventas: clientes,pedidos,facturas", "inventario: productos,almacén"]);
  });

  it("keeps only the matching collections, ignoring case and accents, and drops empty databases", () => {
    expect(shownNames("ALMACEN")).toEqual(["inventario: almacén"]);
    expect(shownNames("ped")).toEqual(["ventas: pedidos"]);
    expect(shownNames("nada")).toEqual([]);
  });

  it("shows every collection of a database whose name matches", () => {
    expect(shownNames("inven")).toEqual(["inventario: productos,almacén"]);
  });
});

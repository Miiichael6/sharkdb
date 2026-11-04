import { describe, expect, it } from "vitest";
import {
  CONFIRM_WORD,
  confirmWindowHeight,
  confirmationMatches,
  dangerExpanded,
  dangerWindowHeight,
  discardChangesRequest,
  type DangerItem,
} from "./confirmation";

describe("confirmWindowHeight", () => {
  it("fits one line", () => {
    expect(confirmWindowHeight({ message: "¿Eliminar?" })).toBe(140);
  });

  it("grows with long messages and explicit line breaks", () => {
    const long = "x".repeat(120);
    expect(confirmWindowHeight({ message: long })).toBe(confirmWindowHeight({ message: "¿Eliminar?" }) + 2 * 20);
    expect(confirmWindowHeight({ message: "a\nb" })).toBe(160);
  });

  it("caps very long messages", () => {
    expect(confirmWindowHeight({ message: "x".repeat(10_000) })).toBe(120 + 12 * 20);
  });

  it("makes room for the detail lines", () => {
    const details = [{ label: "Campo", value: "a" }, { label: "Antes", value: "1" }];
    expect(confirmWindowHeight({ message: "¿Guardar?", details })).toBe(140 + 10 + 2 * 22);
  });

  it("makes room for the comparison table and its header", () => {
    const table = { columns: ["Valor"], rows: [{ label: "Antes", cells: ["1"] }, { label: "Después", cells: ["2"] }] };
    expect(confirmWindowHeight({ message: "¿Guardar?", table })).toBe(140 + 12 + 3 * 26);
  });

  it("makes room for the connection, database and collection", () => {
    const where = { server: { name: "LOCAL", host: "localhost:27017" }, db: "shop", coll: "orders" };
    expect(confirmWindowHeight({ message: "¿Eliminar?", where })).toBe(140 + 34);
  });
});

describe("confirmationMatches", () => {
  it("accepts the word ignoring case and spaces at the ends", () => {
    expect(confirmationMatches("Confirmo ")).toBe(true);
    expect(confirmationMatches("CONFIRMO")).toBe(true);
    expect(confirmationMatches(CONFIRM_WORD)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(confirmationMatches("confirmar")).toBe(false);
    expect(confirmationMatches("con firmo")).toBe(false);
    expect(confirmationMatches("")).toBe(false);
  });
});

describe("discardChangesRequest", () => {
  it("names what would be lost and offers to discard it", () => {
    const request = discardChangesRequest("El documento");
    expect(request).toMatchObject({ title: "Cambios sin guardar", confirmLabel: "Descartar" });
    expect(request.message).toMatch(/^El documento tiene cambios sin guardar/);
  });
});

describe("dangerWindowHeight", () => {
  const db = (name: string, collections: number): DangerItem => ({
    badge: "nueva",
    kind: "create",
    name,
    detail: "",
    collections: Array.from({ length: collections }, (_, i) => `c${i}`),
  });

  it("opens the databases of a small operation and folds those of a big one", () => {
    expect(dangerExpanded([db("a", 60)])).toBe(true);
    expect(dangerExpanded([db("a", 10), db("b", 20)])).toBe(true);
    expect(dangerExpanded([db("a", 30), db("b", 20)])).toBe(false);
  });

  it("grows with what it lists, up to where the list scrolls", () => {
    const one = dangerWindowHeight({ items: [db("a", 3)] });
    const sixteen = dangerWindowHeight({ items: [db("a", 16)] });
    expect(sixteen).toBeGreaterThan(one);
    expect(dangerWindowHeight({ items: [db("a", 500)] })).toBe(dangerWindowHeight({ items: [db("a", 900)] }));
    expect(dangerWindowHeight({ items: [db("a", 3)], blocked: "x" })).toBeGreaterThan(one);
  });
});

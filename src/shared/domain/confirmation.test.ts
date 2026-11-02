import { describe, expect, it } from "vitest";
import { CONFIRM_WORD, confirmWindowHeight, confirmationMatches, discardChangesRequest } from "./confirmation";

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

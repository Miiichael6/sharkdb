import { describe, expect, it } from "vitest";
import { CONFIRM_WORD, confirmWindowHeight, confirmationMatches } from "./confirmation";

describe("confirmWindowHeight", () => {
  it("fits one line", () => {
    expect(confirmWindowHeight("¿Eliminar?")).toBe(140);
  });

  it("grows with long messages and explicit line breaks", () => {
    const long = "x".repeat(120);
    expect(confirmWindowHeight(long)).toBe(confirmWindowHeight("¿Eliminar?") + 2 * 20);
    expect(confirmWindowHeight("a\nb")).toBe(160);
  });

  it("caps very long messages", () => {
    expect(confirmWindowHeight("x".repeat(10_000))).toBe(120 + 12 * 20);
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

import { describe, expect, it } from "vitest";
import { confirmWindowHeight } from "./confirmation";

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

import { describe, expect, it } from "vitest";
import { clickRow, moveAnchor, NO_SELECTION, toggleRow, type ListSelection } from "./databaseChoice";

const ROWS = ["crm", "shop", "admin", "logs"];
const only = (name: string): ListSelection => ({ selected: [name], anchor: name });

describe("clickRow", () => {
  it("toggles the clicked row and keeps the others checked", () => {
    const two = clickRow(ROWS, only("crm"), "admin", false);
    expect(two).toEqual({ selected: ["crm", "admin"], anchor: "admin" });
    expect(clickRow(ROWS, two, "crm", false).selected).toEqual(["admin"]);
  });

  it("adds the range from the anchor with Shift, in both directions, keeping what was checked", () => {
    expect(clickRow(ROWS, only("shop"), "logs", true)).toEqual({ selected: ["shop", "admin", "logs"], anchor: "shop" });
    expect(clickRow(ROWS, { selected: ["logs"], anchor: "admin" }, "crm", true).selected).toEqual([
      "logs",
      "crm",
      "shop",
      "admin",
    ]);
  });

  it("treats Shift without an anchor as a plain click", () => {
    expect(clickRow(ROWS, NO_SELECTION, "shop", true)).toEqual(only("shop"));
  });
});

describe("toggleRow", () => {
  it("adds and removes, like the checkbox", () => {
    expect(toggleRow(toggleRow(NO_SELECTION, "crm"), "crm").selected).toEqual([]);
  });
});

describe("moveAnchor", () => {
  it("starts at the first row and stays inside the list", () => {
    expect(moveAnchor(ROWS, NO_SELECTION, 1)).toBe("crm");
    expect(moveAnchor(ROWS, only("logs"), 1)).toBe("logs");
    expect(moveAnchor(ROWS, only("crm"), -1)).toBe("crm");
    expect(moveAnchor(ROWS, only("shop"), 1)).toBe("admin");
  });
});

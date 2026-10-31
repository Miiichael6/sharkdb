import { describe, expect, it } from "vitest";
import { clickRow, moveAnchor, NO_SELECTION, selectOnly, toggleRow } from "./databaseChoice";

const ROWS = ["crm", "shop", "admin", "logs"];
const plain = { ctrl: false, shift: false };

describe("clickRow", () => {
  it("selects only the clicked row", () => {
    expect(clickRow(ROWS, { selected: ["crm", "shop"], anchor: "crm" }, "logs", plain)).toEqual(selectOnly("logs"));
  });

  it("toggles with Ctrl and moves the anchor", () => {
    const one = clickRow(ROWS, selectOnly("crm"), "admin", { ctrl: true, shift: false });
    expect(one).toEqual({ selected: ["crm", "admin"], anchor: "admin" });
    expect(clickRow(ROWS, one, "crm", { ctrl: true, shift: false }).selected).toEqual(["admin"]);
  });

  it("selects the range from the anchor with Shift, in both directions", () => {
    expect(clickRow(ROWS, selectOnly("shop"), "logs", { ctrl: false, shift: true })).toEqual({
      selected: ["shop", "admin", "logs"],
      anchor: "shop",
    });
    expect(clickRow(ROWS, selectOnly("admin"), "crm", { ctrl: false, shift: true }).selected).toEqual(["crm", "shop", "admin"]);
  });

  it("treats Shift without an anchor as a plain click", () => {
    expect(clickRow(ROWS, NO_SELECTION, "shop", { ctrl: false, shift: true })).toEqual(selectOnly("shop"));
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
    expect(moveAnchor(ROWS, selectOnly("logs"), 1)).toBe("logs");
    expect(moveAnchor(ROWS, selectOnly("crm"), -1)).toBe("crm");
    expect(moveAnchor(ROWS, selectOnly("shop"), 1)).toBe("admin");
  });
});

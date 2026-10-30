import { describe, expect, it } from "vitest";
import { actionForKey, actionTitle, TOOLBAR_ACTIONS, TOOLBAR_LAYOUT, type KeyPress } from "./toolbarActions";

const press = (key: string, mods: Partial<KeyPress> = {}): KeyPress => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("toolbarActions", () => {
  it("maps shortcuts to actions", () => {
    expect(actionForKey(press("b", { ctrlKey: true }), false)).toBe("toggleSidebar");
    expect(actionForKey(press("R", { ctrlKey: true }), false)).toBe("refresh");
    expect(actionForKey(press("F5"), false)).toBe("refresh");
    expect(actionForKey(press("b"), false)).toBeNull();
    expect(actionForKey(press("r", { ctrlKey: true, shiftKey: true }), false)).toBeNull();
    expect(actionForKey(press("r", { ctrlKey: true, altKey: true }), false)).toBeNull();
  });

  it("leaves F5 to the script editor but not Ctrl+R or Ctrl+B", () => {
    expect(actionForKey(press("F5"), true)).toBeNull();
    expect(actionForKey(press("r", { ctrlKey: true }), true)).toBe("refresh");
    expect(actionForKey(press("b", { metaKey: true }), true)).toBe("toggleSidebar");
  });

  it("titles show the shortcuts", () => {
    expect(actionTitle(TOOLBAR_ACTIONS.refresh)).toBe("Refrescar el workspace (Ctrl+R / F5)");
    expect(actionTitle(TOOLBAR_ACTIONS.menu)).toBe("Menú");
  });

  it("lays out every action exactly once", () => {
    const placed = [...TOOLBAR_LAYOUT.left, ...TOOLBAR_LAYOUT.right].flat();
    expect([...placed].sort()).toEqual(Object.keys(TOOLBAR_ACTIONS).sort());
  });
});

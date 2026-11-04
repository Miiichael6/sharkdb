import { describe, expect, it } from "vitest";
import {
  activateTab,
  closeSessionTabs,
  closeTab,
  defaultQuery,
  dropSlot,
  duplicateTab,
  EMPTY_TABS,
  isDirty,
  markSaved,
  moveTab,
  openTab,
  renameTab,
  runCollectionTab,
  switchTabDb,
  updateTab,
  type TabsState,
} from "./tabs";

const on = (db: string, sid = "s1") => ({ sid, serverLabel: "local", db });

/** Three tabs a, b, c with `active` active. */
function three(active: string): TabsState {
  const s = ["a", "b", "c"].reduce((st, id) => openTab(st, id, on(id)), EMPTY_TABS);
  return activateTab(s, active);
}

const ids = (s: TabsState) => s.tabs.map((t) => t.id);

describe("tabs", () => {
  it("opens tabs after the active one and activates them", () => {
    const s = openTab(three("a"), "x", on("test"));
    expect(ids(s)).toEqual(["a", "x", "b", "c"]);
    expect(s.activeId).toBe("x");
    expect(s.tabs[1]).toMatchObject({ title: "test", code: "", filePath: null });
    expect(openTab(EMPTY_TABS, "y", { ...on("shop"), coll: "orders" }).tabs[0]).toMatchObject({ title: "orders", coll: "orders" });
  });

  it("runs on open only when asked, and never in a duplicate", () => {
    expect(openTab(EMPTY_TABS, "a", on("t")).tabs[0].runOnOpen).toBe(false);
    const s = openTab(EMPTY_TABS, "a", { ...on("t"), coll: "c", code: "q", runOnOpen: true });
    expect(s.tabs[0].runOnOpen).toBe(true);
    expect(duplicateTab(s, "a", "copy").tabs.find((t) => t.id === "copy")?.runOnOpen).toBe(false);
  });

  it("runs the tab already on a collection, or opens one", () => {
    const orders = { ...on("shop"), coll: "orders", code: "q", runOnOpen: true };
    const opened = runCollectionTab(three("a"), "x", orders);
    expect(opened.tabs.find((t) => t.id === "x")).toMatchObject({ coll: "orders", runOnOpen: true, runRequest: 0 });

    const again = runCollectionTab(activateTab(opened, "a"), "y", orders);
    expect(ids(again)).toEqual(ids(opened));
    expect(again.activeId).toBe("x");
    expect(again.tabs.find((t) => t.id === "x")?.runRequest).toBe(1);
    // Another server's tab on the same names is not it.
    expect(ids(runCollectionTab(again, "z", { ...orders, sid: "s2" }))).toContain("z");
  });

  it("never reruns a tab on the collection whose code isn't the query asked for", () => {
    const orders = { ...on("shop"), coll: "orders", code: "q", runOnOpen: true };
    const remove = openTab(three("a"), "rm", { ...orders, code: "db.orders.deleteMany({})", runOnOpen: false });
    const viaTemplate = runCollectionTab(remove, "x", orders);
    expect(viaTemplate.tabs.find((t) => t.id === "rm")?.runRequest).toBe(0);
    expect(viaTemplate.activeId).toBe("x");

    const edited = updateTab(viaTemplate, "x", { code: "db.orders.drop()" });
    const next = runCollectionTab(edited, "y", orders);
    expect(next.tabs.find((t) => t.id === "x")?.runRequest).toBe(0);
    expect(next.activeId).toBe("y");
  });

  it("builds the default query for a collection, escaping quotes", () => {
    expect(defaultQuery("users")).toBe("db.getCollection('users').find({})");
    expect(defaultQuery("it's")).toBe("db.getCollection('it\\'s').find({})");
  });

  it("closing the active tab activates its right neighbour, or the left one at the end", () => {
    expect(closeTab(three("b"), "b")).toMatchObject({ activeId: "c" });
    expect(closeTab(three("c"), "c")).toMatchObject({ activeId: "b" });
    expect(closeTab(three("a"), "c")).toMatchObject({ activeId: "a" });
    expect(closeTab(openTab(EMPTY_TABS, "x", on("t")), "x")).toEqual(EMPTY_TABS);
  });

  it("closes every tab of a disconnected session", () => {
    const s = openTab(three("a"), "other", on("t", "s2"));
    const next = closeSessionTabs(s, "s1");
    expect(ids(next)).toEqual(["other"]);
    expect(next.activeId).toBe("other");
  });

  it("duplicates a tab next to it without its file", () => {
    let s = openTab(EMPTY_TABS, "a", { ...on("test"), code: "x", filePath: "C:/q.js" });
    s = openTab(s, "b", on("t"));
    s = duplicateTab(s, "a", "copy");
    expect(ids(s)).toEqual(["a", "copy", "b"]);
    expect(s.tabs[1]).toMatchObject({ code: "x", db: "test", filePath: null });
  });

  it("renames, ignoring blank titles", () => {
    expect(renameTab(three("a"), "a", "  mi consulta ").tabs[0].title).toBe("mi consulta");
    expect(renameTab(three("a"), "a", "  ").tabs[0].title).toBe("a");
  });

  it("moves to the database a run switched to, leaving its collection", () => {
    const s = openTab(EMPTY_TABS, "a", { ...on("shop"), coll: "orders" });
    expect(switchTabDb(s, "a", "shop")).toBe(s);
    expect(switchTabDb(s, "a", "catalog").tabs[0]).toMatchObject({ db: "catalog", coll: undefined, title: "orders" });
  });

  it("tracks unsaved changes of file-backed tabs against the last saved code", () => {
    expect(isDirty(openTab(EMPTY_TABS, "n", { ...on("test"), code: "x" }).tabs[0])).toBe(false);
    let s = openTab(EMPTY_TABS, "a", { ...on("test"), code: "1", filePath: "C:/dir/q.js" });
    expect(isDirty(s.tabs[0])).toBe(false);
    s = updateTab(s, "a", { code: "2" });
    expect(isDirty(s.tabs[0])).toBe(true);
    s = markSaved(s, "a", "D:\\otra\\nuevo.js", "2");
    expect(s.tabs[0]).toMatchObject({ title: "nuevo.js", filePath: "D:\\otra\\nuevo.js" });
    expect(isDirty(s.tabs[0])).toBe(false);
  });

  it("moves a tab to another position, keeping the active one", () => {
    expect(ids(moveTab(three("b"), "a", 2))).toEqual(["b", "c", "a"]);
    expect(ids(moveTab(three("b"), "c", 0))).toEqual(["c", "a", "b"]);
    expect(ids(moveTab(three("b"), "a", 99))).toEqual(["b", "c", "a"]);
    expect(moveTab(three("b"), "a", 2).activeId).toBe("b");
  });

  it("drops a dragged tab on the slot under its centre", () => {
    expect(dropSlot(0, 100, 3)).toBe(0);
    expect(dropSlot(49, 100, 3)).toBe(0);
    expect(dropSlot(51, 100, 3)).toBe(1);
    expect(dropSlot(-80, 100, 3)).toBe(0);
    expect(dropSlot(500, 100, 3)).toBe(2);
  });

  it("ignores unknown ids", () => {
    const s = three("a");
    expect(activateTab(s, "zz")).toBe(s);
    expect(closeTab(s, "zz")).toBe(s);
    expect(duplicateTab(s, "zz", "n")).toBe(s);
  });
});

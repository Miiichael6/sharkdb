import { describe, expect, it } from "vitest";
import {
  activateTab,
  closeSessionTabs,
  closeTab,
  defaultQuery,
  duplicateTab,
  EMPTY_TABS,
  isDirty,
  markSaved,
  openTab,
  renameTab,
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

  it("ignores unknown ids", () => {
    const s = three("a");
    expect(activateTab(s, "zz")).toBe(s);
    expect(closeTab(s, "zz")).toBe(s);
    expect(duplicateTab(s, "zz", "n")).toBe(s);
  });
});

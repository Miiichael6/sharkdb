import { describe, expect, it } from "vitest";
import {
  activateEntry,
  activeEntryId,
  barEntries,
  clampRatio,
  dropSide,
  MIN_PANE_WIDTH_PX,
  openBeside,
  separateTab,
  setSplitRatio,
  splitWithTab,
} from "./splitTabs";
import {
  activateTab,
  closeSessionTabs,
  closeTab,
  duplicateTab,
  EMPTY_TABS,
  moveTab,
  openTab,
  type TabsState,
} from "./tabs";

const on = (db: string, sid = "s1") => ({ sid, serverLabel: "local", db });

/** Tabs `ids` (in order) with `active` active. */
function tabs(ids: string[], active: string): TabsState {
  return activateTab(ids.reduce((s, id) => openTab(s, id, on(id)), EMPTY_TABS), active);
}

/** Bar as text: plain tabs by id, splits as "left|right". */
const bar = (s: TabsState) => barEntries(s).map((e) => e.panes.map((t) => t.id).join("|"));

describe("split tabs", () => {
  it("puts the dragged tab on the chosen side of the active one", () => {
    const right = splitWithTab(tabs(["a", "b", "c"], "a"), "c", 1);
    expect(bar(right)).toEqual(["a|c", "b"]);
    expect(right.activeId).toBe("c");
    expect(activeEntryId(right)).toBe("a");

    const left = splitWithTab(tabs(["a", "b", "c"], "a"), "c", 0);
    expect(bar(left)).toEqual(["c|a", "b"]);
    expect(barEntries(left)[0].activePane).toBe(0);
  });

  it("ignores dropping the active entry on itself or splitting with nothing active", () => {
    const s = tabs(["a", "b"], "a");
    expect(splitWithTab(s, "a", 1)).toBe(s);
    expect(splitWithTab(EMPTY_TABS, "a", 1)).toBe(EMPTY_TABS);
  });

  it("replaces a pane of the active split, leaving it as a tab where the dragged one was", () => {
    const split = splitWithTab(tabs(["a", "b", "c"], "a"), "b", 1); // a|b, c
    const s = splitWithTab(split, "c", 0);
    expect(bar(s)).toEqual(["c|b", "a"]);
    expect(s.splits).toHaveLength(1);
    expect(s.splits[0].ratio).toBe(split.splits[0].ratio);
  });

  it("brings only the active pane of a dragged split, leaving its other pane in its place", () => {
    let s = splitWithTab(tabs(["a", "b", "c", "d"], "c"), "d", 1); // a, b, c|d (d active)
    s = activateTab(s, "a");
    s = splitWithTab(s, "c", 1);
    expect(bar(s)).toEqual(["a|d", "b", "c"]);
    expect(s.activeId).toBe("d");
  });

  it("activating a split comes back to its last active pane", () => {
    let s = splitWithTab(tabs(["a", "b", "c"], "a"), "b", 1); // a|b
    s = activateTab(s, "a"); // focus the left pane
    s = activateTab(s, "c");
    expect(activateEntry(s, "a").activeId).toBe("a");
    expect(activateEntry(s, "c").activeId).toBe("c");
  });

  it("separates a split, keeping the active pane in place and the other right after it", () => {
    const s = splitWithTab(tabs(["a", "b", "c"], "a"), "c", 0); // c|a, b (c active)
    const apart = separateTab(s, "a");
    expect(bar(apart)).toEqual(["c", "a", "b"]);
    expect(apart.activeId).toBe("c");
    expect(apart.splits).toEqual([]);
    expect(separateTab(apart, "a")).toBe(apart);
  });

  it("closing a pane leaves the other one as a plain, active tab", () => {
    const s = splitWithTab(tabs(["a", "b", "c"], "a"), "c", 1); // a|c (c active), b
    const closed = closeTab(s, "c");
    expect(bar(closed)).toEqual(["a", "b"]);
    expect(closed.activeId).toBe("a");
    expect(closeTab(s, "a").activeId).toBe("c");
  });

  it("closing a session drops its panes and the splits they were in", () => {
    let s = tabs(["a", "b"], "a");
    s = openTab(s, "x", on("t", "s2"));
    s = splitWithTab(s, "b", 1); // a, x|b
    const left = closeSessionTabs(s, "s1");
    expect(bar(left)).toEqual(["x"]);
    expect(left.splits).toEqual([]);
    expect(left.activeId).toBe("x");
  });

  it("duplicating a pane opens the copy after the whole split", () => {
    const s = splitWithTab(tabs(["a", "b", "c"], "a"), "c", 1); // a|c, b
    expect(bar(duplicateTab(s, "a", "copy"))).toEqual(["a|c", "copy", "b"]);
  });

  it("opens new tabs after the active split and moves splits as one entry", () => {
    const s = splitWithTab(tabs(["a", "b", "c"], "a"), "c", 1); // a|c, b
    expect(bar(openTab(s, "n", on("t")))).toEqual(["a|c", "n", "b"]);
    expect(bar(moveTab(s, "c", 1))).toEqual(["b", "a|c"]);
  });

  it("keeps each pane's own ratio, within the minimum pane width", () => {
    const s = setSplitRatio(splitWithTab(tabs(["a", "b"], "a"), "b", 1), "b", 0.3);
    expect(s.splits[0].ratio).toBe(0.3);
    expect(clampRatio(0.05, 1000)).toBe(MIN_PANE_WIDTH_PX / 1000);
    expect(clampRatio(0.99, 1000)).toBe(1 - MIN_PANE_WIDTH_PX / 1000);
    expect(clampRatio(0.4, 1000)).toBe(0.4);
    expect(clampRatio(0.2, 300)).toBe(0.5);
  });

  it("tells which side a drop lands on from the divider's position", () => {
    expect(dropSide(100, 0, 1000, 0.5)).toBe(0);
    expect(dropSide(600, 0, 1000, 0.5)).toBe(1);
    expect(dropSide(600, 0, 1000, 0.7)).toBe(0);
    expect(dropSide(210, 100, 200, 0.5)).toBe(1);
  });

  it("opens a new tab beside the active one, replacing that side of a split", () => {
    const plain = openBeside(tabs(["a", "b"], "a"), "n", on("n"), 0);
    expect(plain.tabs.map((t) => t.id)).toEqual(["n", "a", "b"]);
    expect(plain.splits).toEqual([expect.objectContaining({ left: "n", right: "a", activePane: 0 })]);
    expect(plain.activeId).toBe("n");

    const replaced = openBeside(plain, "m", on("m"), 1);
    expect(replaced.tabs.map((t) => t.id)).toEqual(["n", "m", "a", "b"]);
    expect(replaced.splits).toEqual([expect.objectContaining({ left: "n", right: "m" })]);

    expect(openBeside(EMPTY_TABS, "n", on("n"), 1)).toEqual(openTab(EMPTY_TABS, "n", on("n")));
  });
});

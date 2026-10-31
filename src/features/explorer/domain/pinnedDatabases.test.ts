import { describe, expect, it } from "vitest";
import type { DatabaseEntry } from "./mongo";
import { hasUserDatabases, orderForDialog, toggleFavorite, visibleDatabases } from "./pinnedDatabases";

const entry = (name: string): DatabaseEntry => ({ name, sizeOnDisk: 1024, empty: false });
const SERVER = ["shop", "logs", "admin", "crm"].map(entry);

describe("visibleDatabases", () => {
  it("shows favorites and temporaries once each, alphabetical, and always the system databases", () => {
    const visible = visibleDatabases(["shop", "crm"], ["logs", "shop"], SERVER);
    expect(visible.map((d) => d.name)).toEqual(["admin", "crm", "logs", "shop"]);
    expect(visible.every((d) => !d.missing)).toBe(true);
  });

  it("keeps a favorite the server no longer has, marked missing", () => {
    expect(visibleDatabases(["gone"], [], [])).toEqual([{ name: "gone", sizeOnDisk: 0, empty: true, missing: true }]);
  });

  it("drops a temporary the server no longer has", () => {
    expect(visibleDatabases([], ["gone", "logs"], SERVER).map((d) => d.name)).toEqual(["admin", "logs"]);
  });

  it("shows only the system databases without favorites or temporaries", () => {
    expect(visibleDatabases([], [], SERVER).map((d) => d.name)).toEqual(["admin"]);
  });

  it("never shows a system favorite the server doesn't have as missing", () => {
    expect(visibleDatabases(["config"], [], SERVER).map((d) => d.name)).toEqual(["admin"]);
  });
});

describe("hasUserDatabases", () => {
  it("counts only the user's own databases", () => {
    expect(hasUserDatabases(["admin"], ["local", "config"])).toBe(false);
    expect(hasUserDatabases(["admin"], ["shop"])).toBe(true);
    expect(hasUserDatabases([], [])).toBe(false);
  });
});

describe("toggleFavorite", () => {
  it("marks keeping the list alphabetical and unmarks", () => {
    expect(toggleFavorite(["crm", "shop"], "logs")).toEqual(["crm", "logs", "shop"]);
    expect(toggleFavorite(["crm", "logs"], "crm")).toEqual(["logs"]);
  });
});

describe("orderForDialog", () => {
  it("puts the favorites at opening first, then the rest, each alphabetical", () => {
    expect(orderForDialog(["shop", "logs", "admin", "crm"], ["shop", "crm"])).toEqual(["crm", "shop", "admin", "logs"]);
  });

  it("lists a missing favorite so it can be unmarked", () => {
    expect(orderForDialog(["shop"], ["gone"])).toEqual(["gone", "shop"]);
  });

  it("is frozen: marking a star later only matters the next time the window opens", () => {
    const atOpen = orderForDialog(["b", "a", "c"], []);
    const favorites = toggleFavorite([], "c");
    expect(atOpen).toEqual(["a", "b", "c"]);
    expect(orderForDialog(["b", "a", "c"], favorites)).toEqual(["c", "a", "b"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  NO_CONNECTION,
  NO_DATABASE,
  actionItems,
  connectionItems,
  databaseItems,
  fuzzyRank,
  fuzzyScore,
  type QuickItem,
} from "./quickOpen";

const items = (...labels: string[]): QuickItem[] => labels.map((label) => ({ id: label, label }));
const labels = (list: QuickItem[]) => list.map((i) => i.label);

describe("fuzzyScore", () => {
  it("matches a partial subsequence, case insensitive", () => {
    expect(fuzzyScore("prd", "Producción")).not.toBeNull();
    expect(fuzzyScore("PROD", "producción")).not.toBeNull();
    expect(fuzzyScore("xyz", "producción")).toBeNull();
    expect(fuzzyScore("dp", "producción")).toBeNull();
  });

  it("prefers contiguous and word-start matches", () => {
    expect(fuzzyScore("app", "app_db")!).toBeGreaterThan(fuzzyScore("app", "a_p_p")!);
    expect(fuzzyScore("db", "my db")!).toBeGreaterThan(fuzzyScore("db", "mydb")!);
  });
});

describe("fuzzyRank", () => {
  it("keeps every item in order for an empty query", () => {
    const list = items("b", "a", "c");
    expect(fuzzyRank("  ", list)).toBe(list);
  });

  it("filters and orders by score, ties keep the given order", () => {
    expect(labels(fuzzyRank("log", items("catalog", "logs", "blog", "users")))).toEqual(["logs", "blog", "catalog"]);
    expect(labels(fuzzyRank("a", items("xa", "ya")))).toEqual(["xa", "ya"]);
  });

  it("also searches the detail", () => {
    const list = databaseItems([
      { key: "k1", db: "admin", connection: "Producción" },
      { key: "k2", db: "admin", connection: "Local" },
    ]);
    expect(fuzzyRank("admin loc", list).map((i) => i.id)).toEqual(["k2"]);
  });
});

describe("candidates", () => {
  it("marks open connections", () => {
    const list = connectionItems([
      { id: "1", name: "Local", open: true },
      { id: "2", name: "QA", open: false },
    ]);
    expect(list.map((i) => i.hint)).toEqual(["abierta", undefined]);
  });

  it("offers only sync, backup and restore, enabled with just an open connection", () => {
    const enabled = (target: { connection: boolean; database: boolean }) =>
      actionItems(target).filter((i) => !i.disabled).map((i) => i.id);
    expect(enabled({ connection: true, database: true })).toEqual(["sync", "backup", "restore"]);
    // A connection without databases can still be a sync source.
    expect(enabled({ connection: true, database: false })).toEqual(["sync"]);
    expect(actionItems({ connection: true, database: false })[1].title).toBe(NO_DATABASE);
    expect(actionItems({ connection: false, database: false }).map((i) => i.title)).toEqual([NO_CONNECTION, NO_CONNECTION, NO_CONNECTION]);
  });
});

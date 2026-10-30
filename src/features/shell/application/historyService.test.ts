import { describe, expect, it } from "vitest";
import type { HistoryStore } from "./ports";
import { createHistoryService } from "./historyService";

function fakeStore(initial: Record<string, unknown> = {}) {
  const files = { ...initial };
  let loads = 0;
  const store: HistoryStore = {
    async load(id) {
      loads++;
      if (files[id] === "broken") throw new Error("JSON inválido");
      return files[id] ?? [];
    },
    async save(id, entries) {
      files[id] = entries;
    },
  };
  return { store, files, loads: () => loads };
}

const run = (code: string, at = 1) => ({ code, db: "test", at });

describe("historyService", () => {
  it("loads a connection's history once", async () => {
    const { store, loads } = fakeStore({ c1: [run("a")] });
    const history = createHistoryService(store);
    expect(await history.entries("c1")).toEqual([run("a")]);
    await history.entries("c1");
    expect(loads()).toBe(1);
  });

  it("records runs newest first and persists them", async () => {
    const { store, files } = fakeStore({ c1: [run("a")] });
    const history = createHistoryService(store);
    await history.record("c1", run("b", 2));
    expect(files.c1).toEqual([run("b", 2), run("a")]);
    expect(await history.entries("c1")).toEqual(files.c1);
  });

  it("starts empty when the stored history can't be read", async () => {
    const { store } = fakeStore({ c1: "broken" });
    expect(await createHistoryService(store).entries("c1")).toEqual([]);
  });
});

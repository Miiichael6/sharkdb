import { describe, expect, it } from "vitest";
import { moveRenamedStorage } from "./renamedStorage";

function memoryStorage(entries: Record<string, string>): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
  };
}

const contents = (storage: Storage) =>
  Object.fromEntries(Array.from({ length: storage.length }, (_, i) => storage.key(i)!).map((k) => [k, storage.getItem(k)]));

describe("moveRenamedStorage", () => {
  it("moves the Robo3B keys to SharkDB ones and leaves the rest", () => {
    const storage = memoryStorage({ "robo3b.theme": "dark", "robo3b.sidebarHidden": "true", other: "x" });
    moveRenamedStorage(storage);
    expect(contents(storage)).toEqual({ other: "x", "sharkdb.theme": "dark", "sharkdb.sidebarHidden": "true" });
  });

  it("keeps a value already saved under the new key", () => {
    const storage = memoryStorage({ "robo3b.theme": "dark", "sharkdb.theme": "light" });
    moveRenamedStorage(storage);
    expect(contents(storage)).toEqual({ "sharkdb.theme": "light" });
  });
});

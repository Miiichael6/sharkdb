import { describe, expect, it } from "vitest";
import { collectionsLabel, progressCount, progressPercent, totalDocuments } from "./jobs";

describe("jobs", () => {
  it("measures overall progress across collections", () => {
    expect(progressPercent({ index: 0, count: 2, done: 0, total: 0 })).toBe(0);
    expect(progressPercent({ index: 0, count: 2, done: 50, total: 100 })).toBe(25);
    expect(progressPercent({ index: 1, count: 2, done: 100, total: 100 })).toBe(100);
    expect(progressPercent({ index: 0, count: 1, done: 120, total: 100 })).toBe(100);
    expect(progressPercent({ index: 0, count: 0, done: 1, total: 1 })).toBe(0);
  });

  it("counts the collection in course from 1", () => {
    expect(progressCount({ index: 0, count: 50 })).toBe("1 de 50");
    expect(progressCount({ index: 63, count: 69 })).toBe("64 de 69");
  });

  it("adds up the results", () => {
    const results = [
      { collection: "a", documents: 3, duplicates: 1, indexes: 0 },
      { collection: "b", documents: 2, duplicates: 0, indexes: 1 },
    ];
    expect(totalDocuments(results)).toBe(5);
    expect(collectionsLabel(1)).toBe("1 colección");
    expect(collectionsLabel(2)).toBe("2 colecciones");
  });
});

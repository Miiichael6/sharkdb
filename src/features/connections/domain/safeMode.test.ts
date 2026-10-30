import { describe, expect, it } from "vitest";
import { isWriteOperation, isWritePipeline } from "./safeMode";

describe("isWriteOperation", () => {
  it("lets reads through", () => {
    for (const command of [
      { find: "x", filter: {} },
      { count: "x" },
      { listCollections: 1 },
      { usersInfo: 1 },
      { dbStats: 1 },
      { aggregate: "x", pipeline: [{ $match: {} }], cursor: {} },
      { mapReduce: "x", out: { inline: 1 } },
      {},
    ]) {
      expect(isWriteOperation(command), JSON.stringify(command)).toBe(false);
    }
    for (const method of ["find", "findOne", "countDocuments", "aggregate", "getIndexes"]) {
      expect(isWriteOperation(method), method).toBe(false);
    }
  });

  it("detects write commands whatever their case", () => {
    for (const command of [
      { insert: "x", documents: [] },
      { update: "x", updates: [] },
      { delete: "x", deletes: [] },
      { findAndModify: "x" },
      { findandmodify: "x" },
      { drop: "x" },
      { dropDatabase: 1 },
      { renameCollection: "a.x", to: "a.y" },
      { create: "x" },
      { createIndexes: "x", indexes: [] },
      { dropIndexes: "x", index: "a_1" },
      { createUser: "u", pwd: "p", roles: [] },
      { mapReduce: "x", out: "y" },
    ]) {
      expect(isWriteOperation(command), JSON.stringify(command)).toBe(true);
    }
  });

  it("detects write shell methods", () => {
    for (const method of ["insertOne", "deleteMany", "findOneAndUpdate", "drop", "createIndex", "dropIndex", "createUser"]) {
      expect(isWriteOperation(method), method).toBe(true);
    }
  });

  it("treats aggregations with $out or $merge as writes", () => {
    expect(isWriteOperation({ aggregate: "x", pipeline: [{ $match: {} }, { $out: "y" }] })).toBe(true);
    expect(isWriteOperation({ aggregate: "x", pipeline: [{ $merge: { into: "y" } }] })).toBe(true);
    expect(isWritePipeline([{ $group: { _id: 1 } }, { $out: "y" }])).toBe(true);
    expect(isWritePipeline([{ $match: { $out: 1 } }])).toBe(false);
    expect(isWritePipeline([])).toBe(false);
  });
});

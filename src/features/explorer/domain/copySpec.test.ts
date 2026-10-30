import { describe, expect, it } from "vitest";
import {
  INVALID_COLL_NAME,
  INVALID_DB_NAME,
  TARGET_COLL_REQUIRED,
  TARGET_DB_REQUIRED,
  TARGET_IS_SOURCE,
  copyPipeline,
  indexesToCopy,
  validateCopy,
  type CopyRequest,
} from "./copySpec";

const SOURCE = { sid: "s1", db: "shop", coll: "orders" };
const request = (target: Partial<CopyRequest["target"]>): CopyRequest => ({
  source: SOURCE,
  target: { db: SOURCE.db, coll: SOURCE.coll, ...target },
  copyIndexes: true,
});

describe("copySpec", () => {
  it("trims the destination", () => {
    expect(validateCopy(request({ db: " archive ", coll: " orders " })).target).toEqual({ db: "archive", coll: "orders" });
  });

  it("rejects empty, invalid or identical destinations", () => {
    expect(() => validateCopy(request({ db: " " }))).toThrow(TARGET_DB_REQUIRED);
    expect(() => validateCopy(request({ db: "x", coll: "" }))).toThrow(TARGET_COLL_REQUIRED);
    expect(() => validateCopy(request({ db: "a.b" }))).toThrow(INVALID_DB_NAME);
    expect(() => validateCopy(request({ db: "a b" }))).toThrow(INVALID_DB_NAME);
    expect(() => validateCopy(request({ db: "x", coll: "a$b" }))).toThrow(INVALID_COLL_NAME);
    expect(() => validateCopy(request({ db: "x", coll: "system.js" }))).toThrow(INVALID_COLL_NAME);
    expect(() => validateCopy(request({}))).toThrow(TARGET_IS_SOURCE);
  });

  it("copies on the same server with $out to the target database", () => {
    expect(copyPipeline({ db: "archive", coll: "old" })).toEqual([
      { $match: {} },
      { $out: { db: "archive", coll: "old" } },
    ]);
  });

  it("recreates every index but _id_, without server-managed fields", () => {
    const indexes = [
      { v: 2, name: "_id_", key: { _id: 1 } },
      { v: 2, name: "email_1", key: { email: 1 }, unique: true, ns: "shop.orders" },
    ];
    expect(indexesToCopy(indexes)).toEqual([{ name: "email_1", key: { email: 1 }, unique: true }]);
  });
});

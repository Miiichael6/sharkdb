import { describe, expect, it } from "vitest";
import {
  INVALID_COLL_NAME,
  INVALID_DB_NAME,
  TARGET_COLL_REQUIRED,
  TARGET_DB_REQUIRED,
  TARGET_IS_SOURCE,
  copyPipeline,
  indexesToCopy,
  isSameServer,
  progressPercent,
  validateCopy,
  type CopyRequest,
} from "./copySpec";

const SOURCE = { sid: "s1", db: "shop", coll: "orders" };
const request = (target: Partial<CopyRequest["target"]>): CopyRequest => ({
  source: SOURCE,
  target: { ...SOURCE, ...target },
  copyIndexes: true,
});

describe("copySpec", () => {
  it("trims the destination and tells same-server copies apart", () => {
    const r = validateCopy(request({ db: " archive ", coll: " orders " }));
    expect(r.target).toEqual({ sid: "s1", db: "archive", coll: "orders" });
    expect(isSameServer(r)).toBe(true);
    expect(isSameServer(request({ sid: "s2" }))).toBe(false);
  });

  it("rejects empty, invalid or identical destinations", () => {
    expect(() => validateCopy(request({ db: " " }))).toThrow(TARGET_DB_REQUIRED);
    expect(() => validateCopy(request({ db: "x", coll: "" }))).toThrow(TARGET_COLL_REQUIRED);
    expect(() => validateCopy(request({ db: "a.b" }))).toThrow(INVALID_DB_NAME);
    expect(() => validateCopy(request({ db: "a b" }))).toThrow(INVALID_DB_NAME);
    expect(() => validateCopy(request({ db: "x", coll: "a$b" }))).toThrow(INVALID_COLL_NAME);
    expect(() => validateCopy(request({ db: "x", coll: "system.js" }))).toThrow(INVALID_COLL_NAME);
    expect(() => validateCopy(request({}))).toThrow(TARGET_IS_SOURCE);
    // Same names on another connection are a valid destination.
    expect(validateCopy(request({ sid: "s2" })).target.sid).toBe("s2");
  });

  it("copies on the same server with $out to the target database", () => {
    expect(copyPipeline({ sid: "s1", db: "archive", coll: "old" })).toEqual([
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

  it("reports progress as a whole percentage", () => {
    expect(progressPercent({ copied: 0, total: 0 })).toBe(100);
    expect(progressPercent({ copied: 1, total: 3 })).toBe(33);
    expect(progressPercent({ copied: 60, total: 50 })).toBe(100);
  });
});

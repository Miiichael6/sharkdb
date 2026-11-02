import { describe, expect, it } from "vitest";
import {
  INVALID_COLL_NAME,
  INVALID_DB_NAME,
  TARGET_COLL_REQUIRED,
  TARGET_DB_REQUIRED,
  TARGET_IS_SOURCE,
  copyOptions,
  copyPipeline,
  indexesAfterDocuments,
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
    expect(copyPipeline(request({ db: "archive", coll: "old" }))).toEqual([
      { $match: {} },
      { $out: { db: "archive", coll: "old" } },
    ]);
  });

  it("uses the plain $out name within the same database (any MongoDB version)", () => {
    expect(copyPipeline(request({ db: "shop", coll: "orders_copy" }))[1]).toEqual({ $out: "orders_copy" });
  });

  it("recreates every index but _id_, without server-managed fields", () => {
    const indexes = [
      { v: 2, name: "_id_", key: { _id: 1 } },
      { v: 2, name: "email_1", key: { email: 1 }, unique: true, ns: "shop.orders" },
    ];
    expect(indexesToCopy(indexes)).toEqual([{ name: "email_1", key: { email: 1 }, unique: true }]);
  });

  it("keeps the options $out preserves for the create, and the rest for afterwards", () => {
    const plain = copyOptions({ validator: { a: 1 }, clusteredIndex: { key: { _id: 1 }, unique: true } });
    expect(plain).toEqual({ create: { validator: { a: 1 }, clusteredIndex: { key: { _id: 1 }, unique: true } } });
    expect(indexesAfterDocuments(plain)).toBe(false);

    const capped = copyOptions({ capped: true, size: 1024, max: 0 });
    expect(capped).toEqual({ create: {}, capped: { size: 1024 } });
    expect(indexesAfterDocuments(capped)).toBe(true);

    const ts = copyOptions({ timeseries: { timeField: "t" }, expireAfterSeconds: 5 });
    expect(ts).toEqual({ timeseries: { timeField: "t" }, expireAfterSeconds: 5 });
    expect(indexesAfterDocuments(ts)).toBe(true);

    expect(copyOptions({ viewOn: "orders", pipeline: [] })).toEqual({ create: {} });
  });

  it("gives a time series target to $out in its full form", () => {
    expect(copyPipeline(request({ coll: "m" }), { timeField: "t" })[1]).toEqual({
      $out: { db: "shop", coll: "m", timeseries: { timeField: "t" } },
    });
  });
});

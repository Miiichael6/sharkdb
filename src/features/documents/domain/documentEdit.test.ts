import { describe, expect, it } from "vitest";
import { FAILED_VALIDATION, ID_CHANGED, NO_ID, idFilter, idsFilter, keepId, writeFailure } from "./documentEdit";

const oid = (hex: string) => ({ $oid: hex });
const A = oid("65a1b2c3d4e5f6a7b8c9d0e1");
const B = oid("65a1b2c3d4e5f6a7b8c9d0e2");

describe("idFilter / idsFilter", () => {
  it("match documents by their _id, whatever its type", () => {
    expect(idFilter({ _id: A, name: "x" })).toEqual({ _id: A });
    expect(idFilter({ _id: 0 })).toEqual({ _id: 0 });
    expect(idsFilter([{ _id: A }, { _id: B }])).toEqual({ _id: { $in: [A, B] } });
  });

  it("refuse documents without _id", () => {
    expect(() => idFilter({ name: "x" })).toThrow(NO_ID);
    expect(() => idsFilter([{ _id: A }, {}])).toThrow(NO_ID);
  });
});

describe("keepId", () => {
  it("keeps the original _id, first, when the edit dropped it", () => {
    const edited = keepId({ _id: A, n: 1 }, { n: 2 });
    expect(edited).toEqual({ _id: A, n: 2 });
    expect(Object.keys(edited)[0]).toBe("_id");
  });

  it("accepts the same _id and refuses a different one", () => {
    expect(keepId({ _id: A }, { _id: oid("65a1b2c3d4e5f6a7b8c9d0e1"), n: 2 })).toEqual({ _id: A, n: 2 });
    expect(() => keepId({ _id: A }, { _id: B })).toThrow(ID_CHANGED);
    expect(() => keepId({ _id: { $numberInt: "1" } }, { _id: { $numberDouble: "1.0" } })).toThrow(ID_CHANGED);
  });
});

describe("writeFailure", () => {
  it("reads the first write error or the write concern error", () => {
    expect(writeFailure({ ok: 1, n: 1 })).toBeNull();
    expect(writeFailure({ ok: 1, n: 0, writeErrors: [{ index: 0, code: 11000, errmsg: "E11000 duplicate key" }] })).toBe(
      "E11000 duplicate key",
    );
    expect(writeFailure({ ok: 1, writeConcernError: { errmsg: "timeout" } })).toBe("timeout");
  });

  it("says plainly when the collection's validation refused the document", () => {
    const reply = { ok: 1, n: 0, writeErrors: [{ index: 0, code: 121, errmsg: "Document failed validation" }] };
    expect(writeFailure(reply)).toBe(`${FAILED_VALIDATION} (Document failed validation)`);
  });
});

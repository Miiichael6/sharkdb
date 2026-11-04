import { describe, expect, it } from "vitest";
import { fieldEditRequest } from "./fieldEditConfirmation";

const where = { server: { name: "LOCAL", host: "localhost:27017" }, db: "shop", coll: "orders" };
const doc = { _id: { $oid: "65a1b2c3d4e5f6a7b8c9d0e1" }, EECC: { RUC: "1 " } };

describe("fieldEditRequest", () => {
  it("names the document, the full path and both values with their type, strings quoted", () => {
    const request = fieldEditRequest(where, { doc, path: ["EECC", "RUC"], before: "1 ", after: "" });
    expect(request.where).toBe(where);
    expect(request.details).toEqual([
      { label: "Documento", value: 'ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")' },
      { label: "Campo", value: "EECC.RUC" },
    ]);
    expect(request.table).toEqual({
      columns: ["Valor", "Tipo"],
      rows: [
        { label: "Antes", cells: ['"1 "', "String"] },
        { label: "Después", cells: ['""', "String"] },
      ],
    });
  });

  it("shows numbers and booleans without quotes", () => {
    const request = fieldEditRequest(where, { doc, path: ["n"], before: { $numberInt: "5" }, after: { $numberInt: "6" } });
    expect(request.table?.rows).toEqual([
      { label: "Antes", cells: ["5", "Int32"] },
      { label: "Después", cells: ["6", "Int32"] },
    ]);
  });
});

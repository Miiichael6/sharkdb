import { describe, expect, it } from "vitest";
import type { Doc } from "../../explorer/domain/mongo";
import { DOCUMENT_GONE, ID_CHANGED } from "../domain/documentEdit";
import { createDocumentService } from "./documentService";
import type { DocumentParser, DocumentStore } from "./ports";

const TARGET = { sid: "s1", db: "shop", coll: "orders" };
const A = { $oid: "65a1b2c3d4e5f6a7b8c9d0e1" };
const B = { $oid: "65a1b2c3d4e5f6a7b8c9d0e2" };

const parser: DocumentParser = {
  evaluate: async (text) => ({ document: { text }, error: null }),
};

/** Store recording each write; every write matches `matched` documents. */
function fakeStore(matched = 1) {
  const calls: [string, ...Doc[]][] = [];
  const store: DocumentStore = {
    insert: async (_, doc) => (calls.push(["insert", doc]), matched),
    replace: async (_, filter, doc) => (calls.push(["replace", filter, doc]), matched),
    delete: async (_, filter) => (calls.push(["delete", filter]), matched),
  };
  return { store, calls };
}

describe("documentService", () => {
  it("replaces a document by its _id, keeping the _id when the edit drops it", async () => {
    const { store, calls } = fakeStore();
    const stored = await createDocumentService(parser, store).replaceDocument(TARGET, { _id: A, n: 1 }, { n: 2 });
    expect(stored).toEqual({ _id: A, n: 2 });
    expect(calls).toEqual([["replace", { _id: A }, { _id: A, n: 2 }]]);
  });

  it("refuses to change the _id and reports a document that no longer exists", async () => {
    const service = createDocumentService(parser, fakeStore(0).store);
    await expect(service.replaceDocument(TARGET, { _id: A }, { _id: B })).rejects.toThrow(ID_CHANGED);
    await expect(service.replaceDocument(TARGET, { _id: A }, { n: 2 })).rejects.toThrow(DOCUMENT_GONE);
  });

  it("deletes one document, several by _id, or all of them", async () => {
    const { store, calls } = fakeStore();
    const service = createDocumentService(parser, store);
    await service.deleteDocuments(TARGET, [{ _id: A }]);
    await service.deleteDocuments(TARGET, [{ _id: A }, { _id: B }]);
    await service.deleteAll(TARGET);
    expect(calls).toEqual([
      ["delete", { _id: A }],
      ["delete", { _id: { $in: [A, B] } }],
      ["delete", {}],
    ]);
  });

  it("inserts the document as given and parses through the parser", async () => {
    const { store, calls } = fakeStore();
    const service = createDocumentService(parser, store);
    await service.insertDocument(TARGET, { n: 1 });
    expect(calls).toEqual([["insert", { n: 1 }]]);
    expect(await service.parse("{}")).toEqual({ document: { text: "{}" }, error: null });
    expect(await service.parse("{ a: 1 }")).toEqual({ document: { text: "{ a: NumberInt(1) }" }, error: null });
  });
});

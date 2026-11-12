import { describe, expect, it } from "vitest";
import { newConnection, type MongoConnection, type Tag } from "../../connections/domain/connection";
import {
  DOCUMENTS_REQUIRED,
  NO_COLLECTION,
  NO_ID,
  TARGET_NOT_LOWER,
  documentIds,
  documentSyncConfirmation,
  documentSyncRequest,
  documentSyncSelection,
  documentSyncSummary,
  documentSyncTargets,
  documentSyncUnavailable,
  validateDocumentSync,
  type DocumentSyncRequest,
} from "./documentSync";
import { TARGET_IS_SOURCE, TARGET_REQUIRED } from "./syncPlan";

const connection = (id: string, tag: Tag): MongoConnection => ({ ...newConnection(), id, name: id, host: `${id}.corp`, tag });
const CONNECTIONS = [connection("prod", "production"), connection("qa", "testing"), connection("local", "local")];
const SOURCE = { sid: "prod", db: "shop", coll: "orders" };
const OID = { $oid: "65a1b2c3d4e5f60718293a4b" };

const request = (over: Partial<DocumentSyncRequest> = {}): DocumentSyncRequest => ({
  ...documentSyncRequest(SOURCE, "qa", [OID, 7]),
  ...over,
});

describe("documentSync", () => {
  it("takes the _id of every picked document, or none when one lacks it", () => {
    expect(documentIds([{ _id: OID, name: "a" }, { _id: 7 }])).toEqual([OID, 7]);
    expect(documentIds([{ _id: 1 }, { name: "projected away" }])).toBeNull();
    expect(documentIds([])).toBeNull();
  });

  it("explains why the viewer can't offer it", () => {
    expect(documentSyncUnavailable(null, [{ _id: 1 }])).toBe(NO_COLLECTION);
    expect(documentSyncUnavailable(SOURCE, [{ name: "x" }])).toBe(NO_ID);
    expect(documentSyncUnavailable(SOURCE, [{ _id: 1 }])).toBeUndefined();
  });

  it("builds the request on the same database and collection", () => {
    expect(request()).toEqual({ sourceSid: "prod", targetSid: "qa", db: "shop", collection: "orders", ids: [OID, 7] });
    expect(documentSyncSelection(request())).toEqual([{ db: "shop", collections: ["orders"] }]);
  });

  it("validates the request against the environments", () => {
    expect(validateDocumentSync(request(), CONNECTIONS)).toEqual(request());
    expect(() => validateDocumentSync(request({ targetSid: "" }), CONNECTIONS)).toThrow(TARGET_REQUIRED);
    expect(() => validateDocumentSync(request({ targetSid: "prod" }), CONNECTIONS)).toThrow(TARGET_IS_SOURCE);
    expect(() => validateDocumentSync(request({ ids: [] }), CONNECTIONS)).toThrow(DOCUMENTS_REQUIRED);
    expect(() => validateDocumentSync(request({ sourceSid: "qa", targetSid: "prod" }), CONNECTIONS)).toThrow(TARGET_NOT_LOWER);
    expect(() => validateDocumentSync(request({ targetSid: "gone" }), CONNECTIONS)).toThrow(TARGET_NOT_LOWER);
  });

  it("offers only lower environments as destination", () => {
    expect(documentSyncTargets(CONNECTIONS, [], "prod").map((o) => o.id)).toEqual(["qa", "local"]);
    expect(documentSyncTargets(CONNECTIONS, [], "qa").map((o) => o.id)).toEqual(["local"]);
    expect(documentSyncTargets(CONNECTIONS, [], "local")).toEqual([]);
  });

  it("shows both ends, every document whole and how many no longer exist", () => {
    const documents = [{ _id: OID, name: "a", nested: { deep: 1 } }];
    const confirm = documentSyncConfirmation(request(), CONNECTIONS, documents, "ocupado");
    expect(confirm.source).toMatchObject({ name: "prod", tag: "production", db: "shop", collection: "orders" });
    expect(confirm.target).toMatchObject({ name: "qa", tag: "testing", db: "shop", collection: "orders" });
    expect(confirm.documents).toBe(documents);
    expect(confirm).toMatchObject({ missing: 1, confirmWord: "confirmo", blocked: "ocupado" });
  });

  it("sums what was written for the notice", () => {
    const results = [{ collection: "shop.orders", documents: 2, duplicates: 0, indexes: 0 }];
    expect(documentSyncSummary("qa", request(), results)).toBe("Sincronizados en qa · shop.orders: 2 documentos");
  });
});

import type { DocumentTarget } from "../../../shared/domain/documentTarget";
import type { Doc } from "../../explorer/domain/mongo";
import { DOCUMENT_GONE, idFilter, idsFilter, keepId } from "../domain/documentEdit";
import { markIntegers } from "../domain/markIntegers";
import type { DocumentParser, DocumentStore } from "./ports";

/** Every document of the collection. */
const ALL: Doc = {};

export type DocumentService = ReturnType<typeof createDocumentService>;

export function createDocumentService(parser: DocumentParser, store: DocumentStore) {
  return {
    /** Evaluates an edited document; its plain integers stay Int32 (see `markIntegers`). */
    parse: (text: string) => parser.evaluate(markIntegers(text)),
    insertDocument: async (target: DocumentTarget, doc: Doc) => {
      await store.insert(target, doc);
    },
    /** Replaces `original` with its edited version, keeping its `_id`; resolves to the document stored. */
    async replaceDocument(target: DocumentTarget, original: Doc, edited: Doc) {
      const stored = keepId(original, edited);
      const matched = await store.replace(target, idFilter(original), stored);
      if (!matched) throw new Error(DOCUMENT_GONE);
      return stored;
    },
    /** Deletes these documents (by `_id`); resolves to how many were deleted. */
    deleteDocuments: (target: DocumentTarget, docs: Doc[]) =>
      store.delete(target, docs.length === 1 ? idFilter(docs[0]) : idsFilter(docs)),
    deleteAll: (target: DocumentTarget) => store.delete(target, ALL),
  };
}

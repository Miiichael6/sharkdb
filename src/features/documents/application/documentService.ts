import type { DocumentTarget } from "../../../shared/domain/documentTarget";
import type { Doc } from "../../explorer/domain/mongo";
import { DOCUMENT_CHANGED, DOCUMENT_GONE, idFilter, idsFilter, keepId } from "../domain/documentEdit";
import { markNumbers } from "../domain/markNumbers";
import type { DocumentParser, DocumentStore } from "./ports";

/** Every document of the collection. */
const ALL: Doc = {};

export type DocumentService = ReturnType<typeof createDocumentService>;

export function createDocumentService(parser: DocumentParser, store: DocumentStore) {
  return {
    /** Evaluates an edited document; its numbers keep their type, Int32 or Double (see `markNumbers`). */
    parse: (text: string) => parser.evaluate(markNumbers(text)),
    insertDocument: async (target: DocumentTarget, doc: Doc) => {
      await store.insert(target, doc);
    },
    /**
     * Replaces `original` with its edited version, keeping its `_id`; resolves to the document stored.
     * Fails with `DOCUMENT_CHANGED` if someone changed it since it was read, unless `overwrite`.
     */
    async replaceDocument(target: DocumentTarget, original: Doc, edited: Doc, overwrite = false) {
      const stored = keepId(original, edited);
      const matched = overwrite
        ? await store.replace(target, idFilter(original), stored)
        : await store.replaceUnchanged(target, original, stored);
      if (matched) return stored;
      const exists = !overwrite && (await store.count(target, idFilter(original))) > 0;
      throw new Error(exists ? DOCUMENT_CHANGED : DOCUMENT_GONE);
    },
    /** Deletes these documents (by `_id`); resolves to how many were deleted. */
    deleteDocuments: (target: DocumentTarget, docs: Doc[]) =>
      store.delete(target, docs.length === 1 ? idFilter(docs[0]) : idsFilter(docs)),
    deleteAll: (target: DocumentTarget) => store.delete(target, ALL),
  };
}

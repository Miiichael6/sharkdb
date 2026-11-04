import type { DocumentTarget } from "../../../shared/domain/documentTarget";
import type { Doc } from "../../explorer/domain/mongo";
import { DOCUMENT_CHANGED, DOCUMENT_GONE, idFilter, idsFilter, keepId } from "../domain/documentEdit";
import { fieldUpdate, withField } from "../domain/fieldUpdate";
import { markNumbers } from "../domain/markNumbers";
import type { DocumentParser, DocumentStore } from "./ports";

/** Every document of the collection. */
const ALL: Doc = {};

export type DocumentService = ReturnType<typeof createDocumentService>;

export function createDocumentService(parser: DocumentParser, store: DocumentStore) {
  /** Whether the document (by `_id`) is still in the collection, after a write matched nothing. */
  const stillExists = async (target: DocumentTarget, doc: Doc) => (await store.count(target, idFilter(doc))) > 0;

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
      const exists = !overwrite && (await stillExists(target, original));
      throw new Error(exists ? DOCUMENT_CHANGED : DOCUMENT_GONE);
    },
    /**
     * Sets the field at `path` of `doc` from `before` to `after` (`$set`, nothing else is written);
     * resolves to the document as stored. Fails with `DOCUMENT_CHANGED` if the field no longer holds
     * `before` on the server, `DOCUMENT_GONE` if the document is gone.
     */
    async updateField(target: DocumentTarget, doc: Doc, path: string[], before: unknown, after: unknown) {
      const { filter, update } = fieldUpdate(doc, path, before, after);
      if (await store.update(target, filter, update)) return withField(doc, path, after);
      throw new Error((await stillExists(target, doc)) ? DOCUMENT_CHANGED : DOCUMENT_GONE);
    },
    /** Deletes these documents (by `_id`); resolves to how many were deleted. */
    deleteDocuments: (target: DocumentTarget, docs: Doc[]) =>
      store.delete(target, docs.length === 1 ? idFilter(docs[0]) : idsFilter(docs)),
    deleteAll: (target: DocumentTarget) => store.delete(target, ALL),
  };
}

// Rules for editing documents: the `_id` identifies a document and can't change, and write
// command replies report failures inside a successful reply.
import type { Doc } from "../../explorer/domain/mongo";

const ID_FIELD = "_id";

export const NO_ID = "El documento no tiene _id";
export const ID_CHANGED = "No se puede cambiar el _id de un documento";
export const DOCUMENT_GONE = "El documento ya no existe: otro proceso lo eliminó o cambió su _id";

const hasId = (doc: Doc) => Object.prototype.hasOwnProperty.call(doc, ID_FIELD);

/** Extended JSON values compare by their canonical text (same type and same value). */
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function idOf(doc: Doc): unknown {
  if (!hasId(doc)) throw new Error(NO_ID);
  return doc[ID_FIELD];
}

/** Filter matching exactly this document. */
export const idFilter = (doc: Doc): Doc => ({ [ID_FIELD]: idOf(doc) });

/** Filter matching exactly these documents. */
export const idsFilter = (docs: Doc[]): Doc => ({ [ID_FIELD]: { $in: docs.map(idOf) } });

/**
 * The edited text of `original`, ready to replace it: without `_id` it keeps the original one
 * (first, as the server stores it); a different `_id` is refused.
 */
export function keepId(original: Doc, edited: Doc): Doc {
  const id = idOf(original);
  if (!hasId(edited)) return { [ID_FIELD]: id, ...edited };
  if (!sameValue(edited[ID_FIELD], id)) throw new Error(ID_CHANGED);
  return edited;
}

/** First error a write command reply carries (`writeErrors`, `writeConcernError`), or null. */
export function writeFailure(reply: Doc): string | null {
  const writeError = Array.isArray(reply.writeErrors) ? reply.writeErrors[0] : null;
  if (writeError) return String(writeError.errmsg ?? writeError.code);
  if (reply.writeConcernError) return String(reply.writeConcernError.errmsg);
  return null;
}

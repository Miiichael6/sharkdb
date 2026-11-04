import type { DocumentTarget } from "../../../shared/domain/documentTarget";
import type { Doc } from "../../explorer/domain/mongo";
import type { ScriptError } from "../../shell/domain/outcome";

/** A document's text evaluated with shell syntax: the document (canonical Extended JSON) or why not. */
export interface DocumentEval {
  document: Doc | null;
  error: ScriptError | null;
}

/** Turns the editor's text into a document, accepting `ObjectId(…)`, `ISODate(…)`… like the shell. */
export interface DocumentParser {
  evaluate(text: string): Promise<DocumentEval>;
}

/** Writes on the documents of a collection; each call resolves to how many documents it matched. */
export interface DocumentStore {
  insert(target: DocumentTarget, doc: Doc): Promise<number>;
  replace(target: DocumentTarget, filter: Doc, doc: Doc): Promise<number>;
  /**
   * Replaces `original` (as it was read) with `doc` only while the server still stores it unchanged;
   * 0 when someone changed it or it is gone. Integer-like keys, which a JS object lists first, may be
   * in another order in `original`: they don't count as a change.
   */
  replaceUnchanged(target: DocumentTarget, original: Doc, doc: Doc): Promise<number>;
  /** Applies `update` (update operators such as `$set`) to the one document `filter` matches. */
  update(target: DocumentTarget, filter: Doc, update: Doc): Promise<number>;
  delete(target: DocumentTarget, filter: Doc): Promise<number>;
  /** How many documents match `filter` (a read). */
  count(target: DocumentTarget, filter: Doc): Promise<number>;
}

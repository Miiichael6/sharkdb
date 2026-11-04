// DocumentStore built on the insert / update / delete write commands. Documents travel as
// canonical Extended JSON, so their BSON types reach the server unchanged.
import type { CommandRunner } from "../../../shared/infrastructure/commandRunner";
import { call } from "../../../shared/infrastructure/tauri";
import type { DocumentStore } from "../application/ports";
import { writeFailure } from "../domain/documentEdit";
import type { Doc } from "../../explorer/domain/mongo";

/** `limit` of a delete statement: 0 removes every match. */
const EVERY_MATCH = 0;

/**
 * Replaces `original` with `replacement` only while the server still stores it; replies like the
 * `update` command. Done in the backend: it compares with the stored document in its own field
 * order, which a JS object loses for integer-like keys.
 */
export type UnchangedReplacer = (sid: string, db: string, coll: string, original: Doc, replacement: Doc) => Promise<Doc>;

export const tauriUnchangedReplacer: UnchangedReplacer = (sid, db, coll, original, replacement) =>
  call<Doc>("replace_unchanged", { id: sid, db, coll, original, replacement });

export function createCommandDocumentStore(run: CommandRunner, replaceUnchanged: UnchangedReplacer): DocumentStore {
  /** Resolves to the documents a write reply matched, failing on write errors. */
  const matched = async (pending: Promise<Doc>) => {
    const reply = await pending;
    const failure = writeFailure(reply);
    if (failure) throw new Error(failure);
    return Number(reply.n ?? 0);
  };
  const write = (sid: string, db: string, command: Doc) => matched(run(sid, db, command));

  return {
    insert: ({ sid, db, coll }, doc) => write(sid, db, { insert: coll, documents: [doc] }),
    replace: ({ sid, db, coll }, filter, doc) =>
      write(sid, db, { update: coll, updates: [{ q: filter, u: doc, upsert: false }] }),
    update: ({ sid, db, coll }, filter, update) =>
      write(sid, db, { update: coll, updates: [{ q: filter, u: update, upsert: false, multi: false }] }),
    replaceUnchanged: ({ sid, db, coll }, original, doc) => matched(replaceUnchanged(sid, db, coll, original, doc)),
    delete: ({ sid, db, coll }, filter) => write(sid, db, { delete: coll, deletes: [{ q: filter, limit: EVERY_MATCH }] }),
    count: async ({ sid, db, coll }, filter) => Number((await run(sid, db, { count: coll, query: filter })).n ?? 0),
  };
}

// DocumentStore built on the insert / update / delete write commands. Documents travel as
// canonical Extended JSON, so their BSON types reach the server unchanged.
import type { CommandRunner } from "../../../shared/infrastructure/commandRunner";
import type { DocumentStore } from "../application/ports";
import { writeFailure } from "../domain/documentEdit";
import type { Doc } from "../../explorer/domain/mongo";

/** `limit` of a delete statement: 0 removes every match. */
const EVERY_MATCH = 0;

export function createCommandDocumentStore(run: CommandRunner): DocumentStore {
  /** Runs a write command and resolves to the documents it matched, failing on write errors. */
  const write = async (sid: string, db: string, command: Doc) => {
    const reply = await run(sid, db, command);
    const failure = writeFailure(reply);
    if (failure) throw new Error(failure);
    return Number(reply.n ?? 0);
  };

  return {
    insert: ({ sid, db, coll }, doc) => write(sid, db, { insert: coll, documents: [doc] }),
    replace: ({ sid, db, coll }, filter, doc) =>
      write(sid, db, { update: coll, updates: [{ q: filter, u: doc, upsert: false }] }),
    delete: ({ sid, db, coll }, filter) => write(sid, db, { delete: coll, deletes: [{ q: filter, limit: EVERY_MATCH }] }),
  };
}

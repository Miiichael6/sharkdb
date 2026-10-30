import { firstBatch, type CommandRunner } from "../../../shared/infrastructure/commandRunner";
import type { Doc } from "../../explorer/domain/mongo";
import type { SchemaSource } from "../application/ports";

/** SchemaSource over plain database commands, outside any tab's shell so it never waits on a script. */
export function createCommandSchemaSource(run: CommandRunner): SchemaSource {
  return {
    async listCollections(sid, db) {
      const reply = await run(sid, db, { listCollections: 1, nameOnly: true, authorizedCollections: true });
      return firstBatch<{ name: string }>(reply).map((c) => c.name).sort();
    },
    async sampleDocuments(sid, db, coll, limit) {
      return firstBatch<Doc>(await run(sid, db, { find: coll, limit, singleBatch: true }));
    },
  };
}

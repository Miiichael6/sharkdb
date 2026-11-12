import { describe, expect, it } from "vitest";
import type { JobListener, StartJob } from "../../../shared/application/jobRunner";
import { newConnection, type MongoConnection, type Tag } from "../../connections/domain/connection";
import { TARGET_NOT_LOWER, type DocumentSyncRequest } from "../domain/documentSync";
import { TARGET_IS_SOURCE, type SyncRequest } from "../domain/syncPlan";
import type { SyncGateway } from "./ports";
import { createSyncService } from "./syncService";

const REQUEST: SyncRequest = { sourceSid: "prod", targetSid: "qa", databases: [{ db: "shop", collections: ["orders"] }] };
const DOCUMENTS: DocumentSyncRequest = { sourceSid: "prod", targetSid: "qa", db: "shop", collection: "orders", ids: [1, 2] };
const RESULT = [{ collection: "shop.orders", documents: 2, duplicates: 0, indexes: 1 }];
const CATALOG = [{ name: "shop", sizeOnDisk: 10, collections: ["orders"] }];
const FULL = [{ _id: 1, name: "a" }];

const connection = (id: string, tag: Tag): MongoConnection => ({ ...newConnection(), id, name: id, host: `${id}.corp`, tag });
const CONNECTIONS = [connection("prod", "production"), connection("qa", "testing")];

/** Gateway that records what reached the backend. */
function fakeGateway() {
  const sent: unknown[] = [];
  const gateway: SyncGateway = {
    databaseCatalog: async (sid) => {
      sent.push({ sid });
      return CATALOG;
    },
    sync: async (job, request) => {
      sent.push({ job, request });
      return RESULT;
    },
    loadFullDocuments: async (sid, db, collection, ids) => {
      sent.push({ sid, db, collection, ids });
      return FULL;
    },
    syncDocuments: async (job, request) => {
      sent.push({ job, documents: request });
      return RESULT;
    },
    findLeftovers: async () => [],
    dropLeftovers: async () => {},
  };
  return { gateway, sent };
}

const start: StartJob = (run) => ({ result: run("job-1"), cancel: () => {} });
const IGNORED: JobListener = { progress: () => {}, collection: () => {} };

describe("syncService", () => {
  it("sends the validated request under the job's id", async () => {
    const { gateway, sent } = fakeGateway();
    const running = createSyncService(gateway, start).sync(REQUEST, IGNORED);
    expect(await running.result).toEqual(RESULT);
    expect(sent).toEqual([{ job: "job-1", request: REQUEST }]);
  });

  it("rejects the source as destination without calling the backend", async () => {
    const { gateway, sent } = fakeGateway();
    const running = createSyncService(gateway, start).sync({ ...REQUEST, targetSid: "prod" }, IGNORED);
    await expect(running.result).rejects.toBe(TARGET_IS_SOURCE);
    expect(sent).toEqual([]);
  });

  it("lists the databases of a connection", async () => {
    const { gateway, sent } = fakeGateway();
    expect(await createSyncService(gateway, start).databaseCatalog("prod")).toEqual(CATALOG);
    expect(sent).toEqual([{ sid: "prod" }]);
  });

  it("reads the picked documents whole from the source", async () => {
    const { gateway, sent } = fakeGateway();
    expect(await createSyncService(gateway, start).loadFullDocuments(DOCUMENTS)).toEqual(FULL);
    expect(sent).toEqual([{ sid: "prod", db: "shop", collection: "orders", ids: [1, 2] }]);
  });

  it("syncs documents only to a lower environment", async () => {
    const { gateway, sent } = fakeGateway();
    const service = createSyncService(gateway, start);
    expect(await service.syncDocuments(DOCUMENTS, CONNECTIONS, IGNORED).result).toEqual(RESULT);
    const upwards = service.syncDocuments({ ...DOCUMENTS, sourceSid: "qa", targetSid: "prod" }, CONNECTIONS, IGNORED);
    await expect(upwards.result).rejects.toBe(TARGET_NOT_LOWER);
    expect(sent).toEqual([{ job: "job-1", documents: DOCUMENTS }]);
  });
});

import { describe, expect, it } from "vitest";
import type { StartJob } from "../../../shared/application/jobRunner";
import { TARGET_IS_SOURCE, type SyncRequest } from "../domain/syncPlan";
import type { SyncGateway } from "./ports";
import { createSyncService } from "./syncService";

const REQUEST: SyncRequest = { sourceSid: "prod", targetSid: "qa", databases: [{ db: "shop", collections: ["orders"] }] };
const RESULT = [{ collection: "shop.orders", documents: 2, duplicates: 0, indexes: 1 }];
const CATALOG = [{ name: "shop", sizeOnDisk: 10, collections: ["orders"] }];

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
    findLeftovers: async () => [],
    dropLeftovers: async () => {},
  };
  return { gateway, sent };
}

const start: StartJob = (run) => ({ result: run("job-1"), cancel: () => {} });

describe("syncService", () => {
  it("sends the validated request under the job's id", async () => {
    const { gateway, sent } = fakeGateway();
    const running = createSyncService(gateway, start).sync(REQUEST, () => {});
    expect(await running.result).toEqual(RESULT);
    expect(sent).toEqual([{ job: "job-1", request: REQUEST }]);
  });

  it("rejects the source as destination without calling the backend", async () => {
    const { gateway, sent } = fakeGateway();
    const running = createSyncService(gateway, start).sync({ ...REQUEST, targetSid: "prod" }, () => {});
    await expect(running.result).rejects.toBe(TARGET_IS_SOURCE);
    expect(sent).toEqual([]);
  });

  it("lists the databases of a connection", async () => {
    const { gateway, sent } = fakeGateway();
    expect(await createSyncService(gateway, start).databaseCatalog("prod")).toEqual(CATALOG);
    expect(sent).toEqual([{ sid: "prod" }]);
  });
});

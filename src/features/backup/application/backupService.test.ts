import { describe, expect, it } from "vitest";
import type { StartJob } from "../../../shared/application/jobRunner";
import { FOLDER_REQUIRED, type BackupRequest } from "../domain/backupSpec";
import { createBackupService } from "./backupService";
import type { BackupGateway, FolderPicker } from "./ports";

const REQUEST: BackupRequest = { sid: "s1", dir: " C:\\b ", databases: [{ db: "shop", collections: ["orders"] }] };
const RESULT = [{ collection: "shop.orders", documents: 2, duplicates: 0, indexes: 1 }];

/** Gateway that records what reached the backend. */
function fakeGateway() {
  const sent: unknown[] = [];
  const gateway = {
    backup: async (job: string, request: BackupRequest) => {
      sent.push({ job, request });
      return RESULT;
    },
  } as unknown as BackupGateway;
  return { gateway, sent };
}

const picker: FolderPicker = { pickFolder: async () => null };
const start: StartJob = (run) => ({ result: run("job-1"), cancel: () => {} });

describe("backupService", () => {
  it("sends the validated request under the job's id", async () => {
    const { gateway, sent } = fakeGateway();
    const running = createBackupService(gateway, picker, start).backup(REQUEST, () => {});
    expect(await running.result).toEqual(RESULT);
    expect(sent).toEqual([{ job: "job-1", request: { ...REQUEST, dir: "C:\\b" } }]);
  });

  it("rejects an invalid request without calling the backend", async () => {
    const { gateway, sent } = fakeGateway();
    const running = createBackupService(gateway, picker, start).backup({ ...REQUEST, dir: "" }, () => {});
    await expect(running.result).rejects.toBe(FOLDER_REQUIRED);
    expect(sent).toEqual([]);
  });
});

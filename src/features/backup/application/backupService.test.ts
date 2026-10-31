import { describe, expect, it } from "vitest";
import { FOLDER_REQUIRED, type BackupRequest, type JobProgress } from "../domain/backupSpec";
import { createBackupService } from "./backupService";
import type { BackupGateway, FolderPicker } from "./ports";

const REQUEST: BackupRequest = { sid: "s1", db: "shop", collections: ["orders"], dir: "C:\\b\\shop" };
const RESULT = [{ collection: "orders", documents: 2, duplicates: 0, indexes: 1 }];
const progress = (job: string, done: number): JobProgress => ({ job, collection: "orders", index: 0, count: 1, done, total: 2 });

/** Gateway that emits progress for its own job and another one, and records cancels and listeners. */
function fakeGateway() {
  const state = { listeners: 0, cancelled: [] as string[] };
  let emit: (p: JobProgress) => void = () => {};
  const gateway = {
    onProgress: async (listener: (p: JobProgress) => void) => {
      state.listeners++;
      emit = listener;
      return () => void state.listeners--;
    },
    backup: async (job: string) => {
      emit(progress("other", 1));
      emit(progress(job, 2));
      return RESULT;
    },
    cancel: async (job: string) => void state.cancelled.push(job),
  } as unknown as BackupGateway;
  return { gateway, state };
}

const picker: FolderPicker = { pickFolder: async () => null };

describe("backupService", () => {
  it("reports only its own job's progress and stops listening at the end", async () => {
    const { gateway, state } = fakeGateway();
    const service = createBackupService(gateway, picker, () => "job-1");
    const seen: JobProgress[] = [];
    const running = service.backup(REQUEST, (p) => seen.push(p));
    expect(await running.result).toEqual(RESULT);
    expect(seen).toEqual([progress("job-1", 2)]);
    expect(state.listeners).toBe(0);
  });

  it("cancels its own job", async () => {
    const { gateway, state } = fakeGateway();
    const running = createBackupService(gateway, picker, () => "job-2").backup(REQUEST, () => {});
    running.cancel();
    await running.result;
    expect(state.cancelled).toEqual(["job-2"]);
  });

  it("rejects an invalid request without calling the backend", async () => {
    const { gateway, state } = fakeGateway();
    const running = createBackupService(gateway, picker).backup({ ...REQUEST, dir: "" }, () => {});
    await expect(running.result).rejects.toBe(FOLDER_REQUIRED);
    expect(state.listeners).toBe(0);
  });
});

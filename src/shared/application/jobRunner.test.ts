import { describe, expect, it } from "vitest";
import type { JobProgress } from "../domain/jobs";
import { createJobRunner, type JobEvents } from "./jobRunner";

const RESULT = [{ collection: "orders", documents: 2, duplicates: 0, indexes: 1 }];
const progress = (job: string, done: number): JobProgress => ({ job, collection: "orders", index: 0, count: 1, done, total: 2 });

/** Events that let the test emit progress, and record cancels and listeners. */
function fakeEvents() {
  const state = { listeners: 0, cancelled: [] as string[], emit: (_: JobProgress) => {} };
  const events: JobEvents = {
    onProgress: async (listener) => {
      state.listeners++;
      state.emit = listener;
      return () => void state.listeners--;
    },
    cancel: async (job) => void state.cancelled.push(job),
  };
  return { events, state };
}

describe("jobRunner", () => {
  it("reports only its own job's progress and stops listening at the end", async () => {
    const { events, state } = fakeEvents();
    const start = createJobRunner(events, () => "job-1");
    const seen: JobProgress[] = [];
    const running = start(async (job) => {
      state.emit(progress("other", 1));
      state.emit(progress(job, 2));
      return RESULT;
    }, (p) => seen.push(p));
    expect(await running.result).toEqual(RESULT);
    expect(seen).toEqual([progress("job-1", 2)]);
    expect(state.listeners).toBe(0);
  });

  it("cancels its own job", async () => {
    const { events, state } = fakeEvents();
    const running = createJobRunner(events, () => "job-2")(async () => RESULT, () => {});
    running.cancel();
    await running.result;
    expect(state.cancelled).toEqual(["job-2"]);
  });

  it("stops listening when the job fails", async () => {
    const { events, state } = fakeEvents();
    const running = createJobRunner(events)(async () => Promise.reject("boom"), () => {});
    await expect(running.result).rejects.toBe("boom");
    expect(state.listeners).toBe(0);
  });
});

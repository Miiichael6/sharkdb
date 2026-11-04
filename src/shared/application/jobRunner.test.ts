import { describe, expect, it } from "vitest";
import type { CollectionUpdate } from "../domain/collectionProgress";
import type { JobProgress } from "../domain/jobs";
import { createJobRunner, type JobEvents, type JobListener } from "./jobRunner";

const RESULT = [{ collection: "orders", documents: 2, duplicates: 0, indexes: 1 }];
const progress = (job: string, done: number): JobProgress => ({ job, collection: "orders", index: 0, count: 1, done, total: 2 });

const update = (job: string): CollectionUpdate => ({ job, db: "shop", collection: "orders", state: "running", done: 1, total: 2 });
const IGNORED: JobListener = { progress: () => {}, collection: () => {} };

/** Events that let the test emit progress and collection updates, and record cancels and listeners. */
function fakeEvents() {
  const state = {
    listeners: 0,
    cancelled: [] as string[],
    emit: (_: JobProgress) => {},
    emitCollection: (_: CollectionUpdate) => {},
  };
  const listening = () => {
    state.listeners++;
    return () => void state.listeners--;
  };
  const events: JobEvents = {
    onProgress: async (listener) => {
      state.emit = listener;
      return listening();
    },
    onCollection: async (listener) => {
      state.emitCollection = listener;
      return listening();
    },
    cancel: async (job) => void state.cancelled.push(job),
  };
  return { events, state };
}

describe("jobRunner", () => {
  it("reports only its own job's progress and collections, and stops listening at the end", async () => {
    const { events, state } = fakeEvents();
    const start = createJobRunner(events, () => "job-1");
    const seen: JobProgress[] = [];
    const collections: CollectionUpdate[] = [];
    const running = start(
      async (job) => {
        state.emit(progress("other", 1));
        state.emit(progress(job, 2));
        state.emitCollection(update("other"));
        state.emitCollection(update(job));
        return RESULT;
      },
      { progress: (p) => seen.push(p), collection: (u) => collections.push(u) },
    );
    expect(await running.result).toEqual(RESULT);
    expect(seen).toEqual([progress("job-1", 2)]);
    expect(collections).toEqual([update("job-1")]);
    expect(state.listeners).toBe(0);
  });

  it("cancels its own job", async () => {
    const { events, state } = fakeEvents();
    const running = createJobRunner(events, () => "job-2")(async () => RESULT, IGNORED);
    running.cancel();
    await running.result;
    expect(state.cancelled).toEqual(["job-2"]);
  });

  it("stops listening when the job fails", async () => {
    const { events, state } = fakeEvents();
    const running = createJobRunner(events)(async () => Promise.reject("boom"), IGNORED);
    await expect(running.result).rejects.toBe("boom");
    expect(state.listeners).toBe(0);
  });
});

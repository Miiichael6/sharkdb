import { parseHistory, pushHistory, type HistoryEntry } from "../domain/history";
import type { HistoryStore } from "./ports";

export type HistoryService = ReturnType<typeof createHistoryService>;

/** Query history per saved connection, loaded once and saved after every run. */
export function createHistoryService(store: HistoryStore) {
  const loaded = new Map<string, Promise<HistoryEntry[]>>();

  function entries(connectionId: string): Promise<HistoryEntry[]> {
    let history = loaded.get(connectionId);
    if (!history) {
      // A broken history file shouldn't stop the shell: start over with an empty one.
      history = store.load(connectionId).then(parseHistory, () => []);
      loaded.set(connectionId, history);
    }
    return history;
  }

  /** Adds a run and persists the new history, which it returns. */
  async function record(connectionId: string, entry: HistoryEntry): Promise<HistoryEntry[]> {
    const next = pushHistory(await entries(connectionId), entry);
    loaded.set(connectionId, Promise.resolve(next));
    await store.save(connectionId, next);
    return next;
  }

  return { entries, record };
}

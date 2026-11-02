import {
  DEFAULT_SETTINGS,
  parseSettings,
  type Settings,
} from "../domain/settings";
import type { SettingsStore } from "./ports";

export type SettingsService = ReturnType<typeof createSettingsService>;

/**
 * The preferences in use: the defaults until `start` loads the saved ones, then whatever any window
 * saves. `current` is read synchronously, so each run of the shell takes the latest values.
 */
export function createSettingsService(store: SettingsStore) {
  let current: Settings = DEFAULT_SETTINGS;
  const listeners = new Set<(settings: Settings) => void>();

  const update = (raw: unknown) => {
    current = parseSettings(raw);
    listeners.forEach((listener) => listener(current));
  };

  return {
    current: () => current,
    /** Loads the saved preferences and follows later saves; resolves to the function that stops following. */
    async start(): Promise<() => void> {
      const stop = await store.watch(update);
      update(await store.load());
      return stop;
    },
    /** The saved preferences, read again (for the window that edits them). */
    load: async () => parseSettings(await store.load()),
    save: (settings: Settings) => store.save(parseSettings(settings)),
    /** Calls `listener` with each change; returns the function that stops it. */
    subscribe(listener: (settings: Settings) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

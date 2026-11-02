import type { Settings } from "../domain/settings";

/**
 * Where the preferences are kept. What it loads may come from an older version (or be missing);
 * `watch` hears what any window saves, this one included.
 */
export interface SettingsStore {
  load(): Promise<unknown>;
  save(settings: Settings): Promise<void>;
  /** Resolves to the function that stops listening. */
  watch(listener: (settings: unknown) => void): Promise<() => void>;
}

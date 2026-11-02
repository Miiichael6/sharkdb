import { emit, listen } from "@tauri-apps/api/event";
import { call } from "../../../shared/infrastructure/tauri";
import type { SettingsStore } from "../application/ports";

/** Tells every window (the main one included) that the preferences changed. */
const SETTINGS_CHANGED = "settings-changed";

export const tauriSettingsStore: SettingsStore = {
  load: () => call("load_settings"),
  save: async (settings) => {
    await call("save_settings", { settings });
    await emit(SETTINGS_CHANGED, settings);
  },
  watch: (listener) =>
    listen<unknown>(SETTINGS_CHANGED, (e) => listener(e.payload)),
};

import type { ExposurePrefs } from "../application/ports";

const HIDDEN_KEY = "sharkdb.claude.hiddenConnections";

/** The unchecked connections in localStorage; without storage the choice lasts until the app closes. */
export const localExposurePrefs: ExposurePrefs = {
  load() {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]");
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  },
  save(hidden) {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden));
    } catch {
      // Kept in memory only.
    }
  },
};

import { call } from "../../../shared/infrastructure/tauri";
import type { HistoryStore } from "../application/ports";

export const tauriHistoryStore: HistoryStore = {
  load: (connectionId) => call<unknown>("load_history", { connectionId }),
  save: (connectionId, entries) => call<void>("save_history", { connectionId, entries }),
};

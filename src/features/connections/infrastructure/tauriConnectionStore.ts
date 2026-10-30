import { call } from "../../../shared/infrastructure/tauri";
import type { ConnectionStore } from "../application/ports";
import type { MongoConnection } from "../domain/connection";

export const tauriConnectionStore: ConnectionStore = {
  load: () => call<MongoConnection[]>("load_connections"),
  save: (connections) => call<void>("save_connections", { connections }),
};

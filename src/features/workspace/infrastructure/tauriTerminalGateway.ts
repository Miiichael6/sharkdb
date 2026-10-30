import { call } from "../../../shared/infrastructure/tauri";
import type { TerminalGateway } from "../application/ports";

export const tauriTerminalGateway: TerminalGateway = {
  openMongosh: (sid, db) => call<void>("open_mongosh", { id: sid, db }),
};

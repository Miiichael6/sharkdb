import { call } from "../../../shared/infrastructure/tauri";
import type { SessionGateway } from "../application/ports";
import type { ServerInfo } from "../domain/session";

export const tauriSessionGateway: SessionGateway = {
  test: (uri, ssh) => call<ServerInfo>("test_connection", { uri, ssh }),
  open: (id, uri, ssh, safeMode) => call<ServerInfo>("connect", { id, uri, ssh, safeMode }),
  setSafeMode: (id, enabled) => call<void>("set_safe_mode", { id, enabled }),
  close: (id) => call<void>("disconnect", { id }),
  openDetached: (id, uri, ssh, safeMode) => call<ServerInfo>("open_detached", { id, uri, ssh, safeMode }),
  closeDetached: (id) => call<void>("close_detached", { id }),
};

import { call } from "../../../shared/infrastructure/tauri";
import type { SessionGateway } from "../application/ports";
import type { ServerInfo } from "../domain/session";

export const tauriSessionGateway: SessionGateway = {
  test: (uri) => call<ServerInfo>("test_connection", { uri }),
  open: (id, uri) => call<ServerInfo>("connect", { id, uri }),
  close: (id) => call<void>("disconnect", { id }),
};

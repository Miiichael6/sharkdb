import { call } from "../../../shared/infrastructure/tauri";
import type { SessionGateway } from "../application/ports";
import type { ServerInfo } from "../domain/session";

export const tauriSessionGateway: SessionGateway = {
  test: (uri, ssh) => call<ServerInfo>("test_connection", { uri, ssh }),
  open: (id, uri, ssh) => call<ServerInfo>("connect", { id, uri, ssh }),
  close: (id) => call<void>("disconnect", { id }),
};

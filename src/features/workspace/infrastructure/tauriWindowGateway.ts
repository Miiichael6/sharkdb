import { getCurrentWindow } from "@tauri-apps/api/window";
import type { WindowGateway } from "../application/ports";

export const tauriWindowGateway: WindowGateway = {
  setTitle: (title) => getCurrentWindow().setTitle(title),
};

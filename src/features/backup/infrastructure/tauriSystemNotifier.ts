import { call } from "../../../shared/infrastructure/tauri";
import type { SystemNotifier } from "../application/ports";

export const tauriSystemNotifier: SystemNotifier = {
  show: ({ title, body }) => call("show_system_notification", { title, body }),
};

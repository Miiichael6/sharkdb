import type { OtherWindows } from "../application/operationsService";
import { call } from "./tauri";

export const tauriOtherWindows: OtherWindows = {
  busy: () => call("busy_elsewhere"),
};

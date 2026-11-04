import { call } from "../../../shared/infrastructure/tauri";
import type { ScheduleTurn } from "../application/ports";

export const tauriScheduleTurn: ScheduleTurn = {
  take: () => call("take_schedule_turn"),
  release: () => call("release_schedule_turn"),
};

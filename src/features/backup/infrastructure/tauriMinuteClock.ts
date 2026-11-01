import { listen } from "@tauri-apps/api/event";
import type { MinuteClock } from "../application/ports";

/** Emitted by the backend at the start of every minute (`src-tauri/src/schedule/ticker.rs`). */
const TICK_EVENT = "backup-schedule-tick";

export const tauriMinuteClock: MinuteClock = {
  onMinute: (listener) => listen(TICK_EVENT, () => listener()),
};

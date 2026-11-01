import { call } from "../../../shared/infrastructure/tauri";
import type { ScheduleStore } from "../application/ports";

export const tauriScheduleStore: ScheduleStore = {
  load: () => call("load_backup_schedules"),
  save: (schedules) => call("save_backup_schedules", { schedules }),
};

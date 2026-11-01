import { withDefaults, type BackupSchedule } from "../domain/schedule";
import type { ScheduleStore } from "./ports";

export type ScheduleService = ReturnType<typeof createScheduleService>;

export function createScheduleService(store: ScheduleStore) {
  return {
    /** The saved schedules, complete and on quarter hours whatever version saved them. */
    list: async () => (await store.load()).map(withDefaults),
    save: (schedules: BackupSchedule[]) => store.save(schedules),
  };
}

import type { Operation } from "../../../shared/domain/operations";
import { runAlert, startFailedAlert } from "../domain/runAlert";
import { runRequest, runsParent, runsToDelete } from "../domain/runFolders";
import { withDefaults, type BackupSchedule } from "../domain/schedule";
import type { MinuteClock, RunFolders, ScheduleStore, SystemNotifier } from "./ports";

export type ScheduleService = ReturnType<typeof createScheduleService>;

interface Ports {
  store: ScheduleStore;
  runs: RunFolders;
  notifier: SystemNotifier;
  clock: MinuteClock;
}

/** The folder that holds every run of `schedule`; null until it has a destination. */
const parentOf = (schedule: BackupSchedule) => (schedule.backup ? runsParent(schedule.backup.dir, schedule.name) : null);

export function createScheduleService({ store, runs, notifier, clock }: Ports) {
  return {
    /** The saved schedules, complete and on quarter hours whatever version saved them. */
    list: async () => (await store.load()).map(withDefaults),
    save: (schedules: BackupSchedule[]) => store.save(schedules),
    /** The backup of a run at `at`, in a folder no earlier run of the same minute took. */
    async runRequest(schedule: BackupSchedule, at: Date) {
      const parent = parentOf(schedule);
      return runRequest(schedule, at, parent ? await runs.list(parent) : []);
    },
    /** Deletes the oldest runs so only the last ones stay (D16); returns the deleted names. */
    async prune(schedule: BackupSchedule): Promise<string[]> {
      const parent = parentOf(schedule);
      if (!parent) return [];
      const old = runsToDelete(await runs.list(parent));
      if (old.length) await runs.remove(parent, old);
      return old;
    },
    /** Tells the system how a run ended, when the schedule asks for it or it failed (R62). */
    async alertEnded(schedule: BackupSchedule, op: Operation) {
      const alert = runAlert(schedule, op);
      if (alert) await notifier.show(alert);
    },
    /** Tells the system a run couldn't start: always, nobody may be looking. */
    alertNotStarted: (schedule: BackupSchedule, reason: string) => notifier.show(startFailedAlert(schedule, reason)),
    onMinute: clock.onMinute,
  };
}

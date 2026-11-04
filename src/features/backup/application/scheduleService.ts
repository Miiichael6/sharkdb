import type { Operation } from "../../../shared/domain/operations";
import { runAlert, skippedAlert, startFailedAlert } from "../domain/runAlert";
import { runFolder, runRequest, runStamp, runsParent, runsToDelete } from "../domain/runFolders";
import { withDefaults, type BackupSchedule } from "../domain/schedule";
import type { MinuteClock, RunFolders, ScheduleStore, ScheduleTurn, SourceCatalog, SystemNotifier } from "./ports";

export type ScheduleService = ReturnType<typeof createScheduleService>;

interface Ports {
  store: ScheduleStore;
  runs: RunFolders;
  source: SourceCatalog;
  notifier: SystemNotifier;
  clock: MinuteClock;
  turn: ScheduleTurn;
}

/** The folder that holds every run of `schedule`; null until it has a destination. */
const parentOf = (schedule: BackupSchedule) => (schedule.backup ? runsParent(schedule.backup.dir, schedule.name) : null);

export function createScheduleService({ store, runs, source, notifier, clock, turn }: Ports) {
  return {
    /** The saved schedules, complete and on quarter hours whatever version saved them. */
    list: async () => (await store.load()).map(withDefaults),
    save: (schedules: BackupSchedule[]) => store.save(schedules),
    /**
     * The backup of a run at `at`, with what its connection (already connected) has now, in a folder
     * of its own: made here, so no other run (of this window or another) can take it (error 60).
     */
    async runRequest(schedule: BackupSchedule, at: Date) {
      const catalog = schedule.backup ? await source.databaseCatalog(schedule.backup.sid) : [];
      // Checked before making the folder: a run that can't start leaves nothing behind.
      const plan = runRequest(schedule, catalog);
      const run = await runs.create(plan.request.dir, runStamp(at));
      return { ...plan, request: { ...plan.request, dir: runFolder(plan.request.dir, run) } };
    },
    /** Deletes old and unfinished runs so only the last complete ones stay (D16); returns the deleted names. */
    async prune(schedule: BackupSchedule, now = new Date()): Promise<string[]> {
      const parent = parentOf(schedule);
      if (!parent) return [];
      const old = runsToDelete(await runs.list(parent), now);
      if (old.length) await runs.remove(parent, old);
      return old;
    },
    /** Tells the system how a run ended, when the schedule asks for it or it failed (R62). */
    async alertEnded(schedule: BackupSchedule, op: Operation) {
      const alert = runAlert(schedule, op);
      if (alert) await notifier.show(alert);
    },
    /** Tells the system a run skipped what no longer exists: always, nobody may be looking. */
    alertSkipped: (schedule: BackupSchedule, missing: string[]) => notifier.show(skippedAlert(schedule, missing)),
    /** Tells the system a run couldn't start: always, nobody may be looking. */
    alertNotStarted: (schedule: BackupSchedule, reason: string) => notifier.show(startFailedAlert(schedule, reason)),
    onMinute: clock.onMinute,
    takeTurn: turn.take,
    releaseTurn: turn.release,
  };
}

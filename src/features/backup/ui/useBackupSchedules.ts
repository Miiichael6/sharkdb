import { useEffect, useRef, useState } from "react";
import { useServices } from "../../../app/services";
import { destructiveRequest } from "../../../shared/domain/destructiveActions";
import { confirmDeleteInWindow } from "../../../shared/ui/confirmInWindow";
import { useNotify } from "../../../shared/ui/useNotifications";
import { targetServerOf } from "../../connections/domain/connection";
import {
  duplicateSchedule,
  enableBlocker,
  folderTakenBy,
  newSchedule,
  removeSchedule,
  upsertSchedule,
  type BackupSchedule,
} from "../domain/schedule";
import { afterScheduledRun, firstDue, withArming } from "../domain/scheduleTiming";
import { chooseBackup, type BackupWindowsContext } from "./useBackupFlow";
import { useScheduler } from "./useScheduler";
import { useScheduleRun } from "./useScheduleRun";

interface Options extends BackupWindowsContext {
  /** The registered connections finished loading. */
  connectionsLoaded: boolean;
  run: Parameters<typeof useScheduleRun>[0]["run"];
  cancel: Parameters<typeof useScheduleRun>[0]["cancel"];
}

/** The backup schedules of the connections screen: loaded once, saved on every change and run on their own. */
export function useBackupSchedules(options: Options) {
  const { connections, sessions, borrowSession, connectionsLoaded } = options;
  const { schedules: service, backup } = useServices();
  const notify = useNotify();
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The backup windows answer after other edits may have happened: always build on the latest list.
  const latest = useRef(schedules);
  latest.current = schedules;
  const runner = useScheduleRun(options);

  useEffect(() => {
    service.list().then((list) => {
      setSchedules(list);
      setLoaded(true);
    }, notify.fail);
  }, [service]);

  const persist = (next: BackupSchedule[]) => {
    latest.current = next;
    setSchedules(next);
    service.save(next).catch(notify.fail);
  };
  const save = (schedule: BackupSchedule) => persist(upsertSchedule(latest.current, schedule));
  const add = (schedule: BackupSchedule) => {
    save(schedule);
    setSelectedId(schedule.id);
  };

  const connectionOf = (schedule: BackupSchedule) => connections.find((c) => c.id === schedule.backup?.sid);
  const context = () => ({ schedules: latest.current, connectionIds: connections.map((c) => c.id) });

  /** The backup windows, starting from what the schedule saves; the confirmed choice replaces it. */
  const chooseWhat = (schedule: BackupSchedule) => {
    const sid = schedule.backup?.sid ?? sessions[0]?.conn.id ?? connections[0]?.id ?? "";
    return chooseBackup(
      { connections, sessions, borrowSession },
      { sid },
      (backup) => {
        const current = latest.current.find((s) => s.id === schedule.id);
        if (current) save({ ...current, backup });
        return undefined;
      },
      schedule.backup ?? undefined,
    ).catch(notify.fail);
  };

  /** ▶: the backup now; confirmed already when what it saves was chosen (D17). */
  const runNow = (schedule: BackupSchedule) => {
    const blocker = runner.blockerOf(schedule, context());
    if (blocker) notify.fail(blocker);
    else void runner.execute(schedule, new Date());
  };

  /**
   * The first schedule due now, on its own and without asking (D17). It counts as run for that time
   * before starting, so it never runs twice for it, even when it can't start (that is notified).
   */
  const runDue = () => {
    const now = new Date();
    const due = firstDue(latest.current, now);
    if (!due || runner.isBusy()) return;
    save(afterScheduledRun(due, now));
    const blocker = runner.blockerOf(due, context());
    if (blocker) runner.failToStart(due, blocker);
    else void runner.execute(due, now);
  };
  useScheduler({ ready: loaded && connectionsLoaded, runningId: runner.runningId, runDue });

  const remove = async (schedule: BackupSchedule) => {
    const conn = connectionOf(schedule);
    const server = conn ? targetServerOf(conn) : { name: schedule.name, host: "" };
    if (!(await confirmDeleteInWindow(destructiveRequest("deleteSchedule", { server, name: schedule.name })))) return;
    persist(removeSchedule(latest.current, schedule.id));
    setSelectedId((id) => (id === schedule.id ? null : id));
  };

  return {
    schedules,
    selected: schedules.find((s) => s.id === selectedId) ?? null,
    select: setSelectedId,
    runningId: runner.runningId,
    cancelRun: runner.cancelRun,
    connectionOf,
    /** Why ▶ can't run it, if it can't. */
    runBlockerOf: (schedule: BackupSchedule) => runner.blockerOf(schedule, context()),
    /** Why its switch can't be turned on, if it can't. */
    enableBlockerOf: (schedule: BackupSchedule) => enableBlocker(schedule, { ...context(), runningId: runner.runningId }, new Date()),
    /** The other schedule already saving into this one's folder. */
    folderTakenBy: (schedule: BackupSchedule) => folderTakenBy(schedule, latest.current),
    create: () => add(newSchedule(crypto.randomUUID())),
    duplicate: (schedule: BackupSchedule) => add(duplicateSchedule(schedule, crypto.randomUUID())),
    /** An edit from the form or the list; switching on or re-timing doesn't run a time already gone today. */
    change: (id: string, patch: Partial<BackupSchedule>) => {
      const current = latest.current.find((s) => s.id === id);
      if (current) save({ ...current, ...withArming(current, patch, new Date()) });
    },
    chooseWhat,
    openFolder: (dir: string) => void backup.openFolder(dir).catch(notify.fail),
    runNow,
    remove,
  };
}

export type BackupSchedules = ReturnType<typeof useBackupSchedules>;

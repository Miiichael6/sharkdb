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
  const { schedules: service, backup, operations } = useServices();
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
    return service.save(next).catch(notify.fail);
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

  /** Why ▶ can't run `schedule` now: another window has an operation running (error 60), or what the runner says. */
  const runBlockerOf = (schedule: BackupSchedule) => operations.busyElsewhere() ?? runner.blockerOf(schedule, context());

  /** ▶: the backup now; confirmed already when what it saves was chosen (D17). */
  const runNow = (schedule: BackupSchedule) => {
    const blocker = runBlockerOf(schedule);
    if (blocker) notify.fail(blocker);
    else void runner.execute(schedule, new Date());
  };

  // The turn is being asked for: a minute tick and the end of a run must not both take it.
  const claiming = useRef(false);
  const runDueRef = useRef<() => Promise<void>>(async () => {});

  /**
   * The first schedule due now, on its own and without asking (D17). Only with the turn every SharkDB
   * window shares (error 60): while another one runs a schedule (or any backup, restore or sync) this
   * one waits, and the schedules read again from disk tell whether it already ran this one. It counts
   * as run for that time before starting, so it never runs twice for it, even when it can't start
   * (that is notified). The turn is held until the run ends.
   */
  const runDue = async () => {
    if (claiming.current || runner.isBusy() || !firstDue(latest.current, new Date())) return;
    claiming.current = true;
    let ran: Promise<void> | undefined;
    let taken = false;
    try {
      taken = await service.takeTurn();
      if (!taken) return;
      const saved = await service.list();
      latest.current = saved;
      setSchedules(saved);
      const now = new Date();
      const due = firstDue(saved, now);
      if (!due) return;
      await persist(upsertSchedule(saved, afterScheduledRun(due, now)));
      const blocker = runner.blockerOf(due, context());
      if (blocker) runner.failToStart(due, blocker);
      else ran = runner.execute(due, now);
    } catch (e) {
      notify.fail(e);
    } finally {
      claiming.current = false;
      if (taken) {
        void Promise.resolve(ran)
          .finally(() => service.releaseTurn().catch(() => {}))
          // The run ended while the turn was still held: the next one waiting goes now.
          .then(() => ran && runDueRef.current());
      }
    }
  };
  runDueRef.current = runDue;
  useScheduler({ ready: loaded && connectionsLoaded, runningId: runner.runningId, runDue: () => void runDue() });

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
    runBlockerOf,
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

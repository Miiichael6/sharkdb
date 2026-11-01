import { useEffect, useRef, useState } from "react";
import { useServices } from "../../../app/services";
import { destructiveRequest } from "../../../shared/domain/destructiveActions";
import { confirmDeleteInWindow } from "../../../shared/ui/confirmInWindow";
import { useNotify } from "../../../shared/ui/useNotifications";
import { targetServerOf } from "../../connections/domain/connection";
import type { BackupRequest } from "../domain/backupSpec";
import {
  duplicateSchedule,
  enableBlocker,
  folderTakenBy,
  newSchedule,
  removeSchedule,
  runBlocker,
  runRequest,
  upsertSchedule,
  type BackupSchedule,
} from "../domain/schedule";
import { chooseBackup, type BackupWindowsContext } from "./useBackupFlow";

interface Options extends BackupWindowsContext {
  /** Starts a backup in the background: its operation, or null when it didn't start. */
  run: (request: BackupRequest) => { id: string; settled: Promise<unknown> } | null;
  /** Cancels operation `id`, once confirmed. */
  cancel: (operationId: string) => Promise<void>;
}

/** The backup schedules of the connections screen: loaded once and saved on every change. */
export function useBackupSchedules(options: Options) {
  const { connections, sessions, borrowSession, run, cancel } = options;
  const { schedules: service, backup } = useServices();
  const notify = useNotify();
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  // The operation of the running backup, for "Cancelar"; null until it starts.
  const [operationId, setOperationId] = useState<string | null>(null);
  // The backup windows answer after other edits may have happened: always build on the latest list.
  const latest = useRef(schedules);
  latest.current = schedules;
  // Two quick ▶ would both pass before the state updates: the lock is this ref.
  const runningRef = useRef(runningId);

  useEffect(() => {
    service.list().then(setSchedules, notify.fail);
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
  const context = () => ({ schedules: latest.current, connectionIds: connections.map((c) => c.id), runningId: runningRef.current });
  const setRunning = (id: string | null) => {
    runningRef.current = id;
    setRunningId(id);
    if (!id) setOperationId(null);
  };

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

  /** ▶: the backup now, into its own dated folder; confirmed already when what it saves was chosen (D17). */
  const runNow = async (schedule: BackupSchedule) => {
    try {
      const blocker = runBlocker(schedule, context());
      if (blocker) throw blocker;
      const request = runRequest(schedule, new Date());
      setRunning(schedule.id);
      const lent = await borrowSession(request.sid).catch((e) => {
        setRunning(null);
        throw e;
      });
      const started = run(request);
      if (started) setOperationId(started.id);
      void Promise.resolve(started?.settled).finally(() => {
        void lent.release().catch(() => {});
        setRunning(null);
      });
    } catch (e) {
      notify.fail(e);
    }
  };

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
    runningId,
    /** Cancels the running backup, once confirmed; nothing until its operation started. */
    cancelRun: operationId ? () => void cancel(operationId).catch(notify.fail) : undefined,
    connectionOf,
    /** Why ▶ can't run it, if it can't. */
    runBlockerOf: (schedule: BackupSchedule) => runBlocker(schedule, context()),
    /** Why its switch can't be turned on, if it can't. */
    enableBlockerOf: (schedule: BackupSchedule) => enableBlocker(schedule, context(), new Date()),
    /** The other schedule already saving into this one's folder. */
    folderTakenBy: (schedule: BackupSchedule) => folderTakenBy(schedule, latest.current),
    create: () => add(newSchedule(crypto.randomUUID())),
    duplicate: (schedule: BackupSchedule) => add(duplicateSchedule(schedule, crypto.randomUUID())),
    change: (id: string, patch: Partial<BackupSchedule>) => {
      const current = latest.current.find((s) => s.id === id);
      if (current) save({ ...current, ...patch });
    },
    chooseWhat,
    openFolder: (dir: string) => void backup.openFolder(dir).catch(notify.fail),
    runNow,
    remove,
  };
}

export type BackupSchedules = ReturnType<typeof useBackupSchedules>;

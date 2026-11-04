import { useRef, useState } from "react";
import { useServices } from "../../../app/services";
import type { Operation } from "../../../shared/domain/operations";
import { errorMessage } from "../../../shared/errors";
import { useNotify } from "../../../shared/ui/useNotifications";
import type { BorrowedSession } from "../../connections/domain/session";
import type { BackupRequest } from "../domain/backupSpec";
import { missingNote } from "../domain/backupSpec";
import { BACKUP_REQUIRED, runBlocker, type BackupSchedule, type ScheduleContext } from "../domain/schedule";

interface Options {
  /** The connection's open session, or one opened apart for the run and closed after it (R61). */
  borrowSession: (id: string) => Promise<BorrowedSession>;
  /** Starts a backup in the background: its operation, or null when it didn't start. */
  run: (request: BackupRequest) => { id: string; settled: Promise<Operation> } | null;
  /** Cancels operation `id`, once confirmed. */
  cancel: (operationId: string) => Promise<void>;
}

/** One schedule's backup at a time, by ▶ or on its own: its folder, its session, its end and its notices. */
export function useScheduleRun({ borrowSession, run, cancel }: Options) {
  const { schedules: service } = useServices();
  const notify = useNotify();
  const [runningId, setRunningId] = useState<string | null>(null);
  // The operation of the running backup, for "Cancelar"; null until it starts.
  const [operationId, setOperationId] = useState<string | null>(null);
  // Two quick starts would both pass before the state updates: the lock is this ref.
  const runningRef = useRef(runningId);

  const setRunning = (id: string | null) => {
    runningRef.current = id;
    setRunningId(id);
    if (!id) setOperationId(null);
  };

  /** A run that couldn't start: said in the app and, as nobody may be looking, by the system (R62). */
  const failToStart = (schedule: BackupSchedule, e: unknown) => {
    notify.fail(e);
    void service.alertNotStarted(schedule, errorMessage(e)).catch(() => {});
  };

  /**
   * The backup of `schedule` now, into its own dated folder; the caller already checked `blockerOf`.
   * When it ends well the oldest runs go (D16); its end is notified in the app and, if asked or
   * failed, by the system. Never rejects.
   */
  const execute = async (schedule: BackupSchedule, at: Date) => {
    setRunning(schedule.id);
    try {
      if (!schedule.backup) throw BACKUP_REQUIRED;
      // Connected first: the run saves the collections the source has now (error 47).
      const lent = await borrowSession(schedule.backup.sid);
      try {
        const { request, missing } = await service.runRequest(schedule, at);
        if (missing.length) {
          notify.info(`${schedule.name}: ${missingNote(missing)}`);
          void service.alertSkipped(schedule, missing).catch(() => {});
        }
        const started = run(request);
        if (!started) return;
        setOperationId(started.id);
        const ended = await started.settled;
        if (ended.status === "done") await service.prune(schedule).catch(notify.fail);
        await service.alertEnded(schedule, ended).catch(() => {});
      } finally {
        void lent.release().catch(() => {});
      }
    } catch (e) {
      failToStart(schedule, e);
    } finally {
      setRunning(null);
    }
  };

  return {
    runningId,
    isBusy: () => runningRef.current !== null,
    /** Why `schedule` can't run now, if it can't: one backup at a time, and what it lacks. */
    blockerOf: (schedule: BackupSchedule, context: Omit<ScheduleContext, "runningId">) =>
      runBlocker(schedule, { ...context, runningId: runningRef.current }),
    execute,
    failToStart,
    /** Cancels the running backup, once confirmed; nothing until its operation started. */
    cancelRun: operationId ? () => void cancel(operationId).catch(notify.fail) : undefined,
  };
}

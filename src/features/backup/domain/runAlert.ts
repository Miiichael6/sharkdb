// What the system notification says when a schedule's backup ends (R62).
import { operationOutcome, type Operation } from "../../../shared/domain/operations";
import type { BackupSchedule } from "./schedule";

export interface SystemAlert {
  title: string;
  body: string;
}

/** The system notification for a run that ended: when the schedule asks for it, and always when it failed. */
export function runAlert(schedule: BackupSchedule, op: Operation): SystemAlert | null {
  if (!schedule.notify && op.status !== "failed") return null;
  return { title: `Backup “${schedule.name}”`, body: operationOutcome(op) };
}

/** A run that couldn't even start (no connection, server down…) is a failure: always notified. */
export const startFailedAlert = (schedule: BackupSchedule, reason: string): SystemAlert => ({
  title: `Backup “${schedule.name}”`,
  body: `No se pudo hacer: ${reason}`,
});

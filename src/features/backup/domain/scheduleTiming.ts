// When a schedule runs on its own: its next run, whether one is due now and what a run leaves behind.
// Only while the app is open (D15): a run missed today because it was closed is made when it opens.
import { clockLabel, dateStamp, localDate, pad, type BackupSchedule } from "./schedule";

/** A monthly run on day 31 is at most two months away; every other frequency, a week. */
const LOOKAHEAD_DAYS = 62;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const ISO_SUNDAY = 7;

/** Fields that change when a schedule runs: editing them re-arms it. */
const TIMING_FIELDS = ["enabled", "repeat", "time", "weekdays", "dayOfMonth", "date"] as const;

const isoWeekday = (day: Date) => day.getDay() || ISO_SUNDAY;
const daysInMonth = (day: Date) => new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
const addDays = (day: Date, days: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate() + days);
const floorMinute = (iso: string) => Math.floor(Date.parse(iso) / MS_PER_MINUTE) * MS_PER_MINUTE;

/** `day` at the schedule's "HH:MM", local time. */
function atTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

/** "Cada hora" in the hour of `now`, at the schedule's minutes. */
const inThisHour = (now: Date, time: string) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), Number(time.split(":")[1]));

/** Runs on its own, now or later: switched on and not "Manual". */
const runsOnItsOwn = (schedule: BackupSchedule) => schedule.enabled && schedule.repeat !== "manual";

/** Whether a daily, weekly, monthly or once schedule runs on `day`; a month without its day runs on its last one. */
function runsOn(schedule: BackupSchedule, day: Date): boolean {
  switch (schedule.repeat) {
    case "daily":
      return true;
    case "weekly":
      return schedule.weekdays.includes(isoWeekday(day));
    case "monthly":
      return day.getDate() === Math.min(schedule.dayOfMonth, daysInMonth(day));
    case "once":
      return schedule.date === dateStamp(day);
    default:
      return false;
  }
}

/** Its last run time today that is already here, if any: today's only, a missed day is not made up (D15). */
function latestToday(schedule: BackupSchedule, now: Date): Date | null {
  if (schedule.repeat === "hourly") {
    const thisHour = inThisHour(now, schedule.time);
    const latest = thisHour <= now ? thisHour : new Date(thisHour.getTime() - MS_PER_HOUR);
    return dateStamp(latest) === dateStamp(now) ? latest : null;
  }
  if (!runsOn(schedule, now)) return null;
  const today = atTime(now, schedule.time);
  return today <= now ? today : null;
}

/**
 * The run time due now, or null: the latest one today that has come, not run yet (`lastScheduledRun`)
 * and not from before it was switched on or re-timed (`armedAt`). With the app closed at that time,
 * it is due as soon as it opens, the same day (D15).
 */
export function dueRun(schedule: BackupSchedule, now: Date): Date | null {
  if (!runsOnItsOwn(schedule)) return null;
  const due = latestToday(schedule, now);
  if (!due) return null;
  if (schedule.lastScheduledRun && due.getTime() <= floorMinute(schedule.lastScheduledRun)) return null;
  if (schedule.armedAt && due.getTime() < floorMinute(schedule.armedAt)) return null;
  return due;
}

export const isDue = (schedule: BackupSchedule, now: Date) => dueRun(schedule, now) !== null;

/** The first schedule due now, in list order: one backup runs at a time, the rest wait their turn. */
export const firstDue = (schedules: BackupSchedule[], now: Date) => schedules.find((s) => isDue(s, now));

/** When it will run next, after `now`; null when it won't run on its own (off, "Manual" or a "Una vez" gone). */
export function nextRun(schedule: BackupSchedule, now: Date): Date | null {
  if (!runsOnItsOwn(schedule)) return null;
  if (schedule.repeat === "hourly") {
    const thisHour = inThisHour(now, schedule.time);
    return thisHour > now ? thisHour : new Date(thisHour.getTime() + MS_PER_HOUR);
  }
  for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset++) {
    const day = addDays(now, offset);
    if (!runsOn(schedule, day)) continue;
    const run = atTime(day, schedule.time);
    if (run > now) return run;
  }
  return null;
}

/** An edit to a schedule; switching it on or changing when it runs re-arms it, so a time already gone today doesn't run at once. */
export function withArming(schedule: BackupSchedule, patch: Partial<BackupSchedule>, now: Date): Partial<BackupSchedule> {
  const retimed = TIMING_FIELDS.some((field) => field in patch);
  const enabled = patch.enabled ?? schedule.enabled;
  return retimed && enabled ? { ...patch, armedAt: now.toISOString() } : patch;
}

/** The schedule once its automatic run at `at` started: it won't run again for that time, and "Una vez" switches off. */
export const afterScheduledRun = (schedule: BackupSchedule, at: Date): BackupSchedule => ({
  ...schedule,
  lastScheduledRun: at.toISOString(),
  enabled: schedule.repeat === "once" ? false : schedule.enabled,
});

/** "05/11/2026 2:00 a. m.". */
export const momentLabel = (at: Date) => `${localDate(dateStamp(at))} ${clockLabel(`${pad(at.getHours())}:${pad(at.getMinutes())}`)}`;

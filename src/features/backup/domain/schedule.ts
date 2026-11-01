// Backups that repeat on their own (every day, week, hour or month, or once) or only by hand, like
// TablePlus' backup schedules: what each one saves and where.
import { databasesLabel } from "../../../shared/domain/databasePlan";
import { collectionsLabel } from "../../../shared/domain/jobs";
import type { BackupRequest } from "./backupSpec";

export type Repeat = "daily" | "weekly" | "hourly" | "once" | "monthly" | "manual";

export const REPEAT_OPTIONS: readonly { id: Repeat; label: string }[] = [
  { id: "daily", label: "Diario" },
  { id: "weekly", label: "Semanal" },
  { id: "hourly", label: "Cada hora" },
  { id: "once", label: "Una vez" },
  { id: "monthly", label: "Mensual" },
  { id: "manual", label: "Manual" },
];

/** Monday first; `id` is the ISO weekday (1 = lunes … 7 = domingo). */
export const WEEKDAYS = [
  { id: 1, short: "L", plural: "lunes" },
  { id: 2, short: "M", plural: "martes" },
  { id: 3, short: "X", plural: "miércoles" },
  { id: 4, short: "J", plural: "jueves" },
  { id: 5, short: "V", plural: "viernes" },
  { id: 6, short: "S", plural: "sábados" },
  { id: 7, short: "D", plural: "domingos" },
] as const;

export interface BackupSchedule {
  id: string;
  name: string;
  enabled: boolean;
  repeat: Repeat;
  /** "HH:MM", 24 hours, local time, always on a quarter hour; "hourly" uses only the minutes. */
  time: string;
  /** "weekly": the ISO weekdays it runs on, sorted, never empty. */
  weekdays: number[];
  /** "monthly": 1 to 31; a month without that day runs on its last one. */
  dayOfMonth: number;
  /** "once": "AAAA-MM-DD", null until chosen. */
  date: string | null;
  /** Notify through the system when a run ends. */
  notify: boolean;
  /** What it saves and where, confirmed with the confirmation word; null until chosen. */
  backup: BackupRequest | null;
}

export const DEFAULT_SCHEDULE_NAME = "Backup sin nombre";
export const DEFAULT_TIME = "02:00";
export const BACKUP_REQUIRED = "Elige qué guardar y dónde";
const DEFAULT_WEEKDAYS = [1];
const WORKDAYS = [1, 2, 3, 4, 5];
const WEEKEND = [6, 7];
export const MAX_DAY_OF_MONTH = 31;
/** Every month has a 28th: past it, the summary says what happens in shorter months. */
const DAYS_IN_EVERY_MONTH = 28;

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
/** A schedule runs on the hour or at a quarter past, half past or a quarter to: never at 14:43. */
const MINUTE_STEP = 15;

const pad = (n: number) => String(n).padStart(2, "0");

export const SCHEDULE_MINUTES = Array.from({ length: MINUTES_PER_HOUR / MINUTE_STEP }, (_, i) => pad(i * MINUTE_STEP));

/** `time` moved to the nearest quarter hour ("14:43" → "14:45", "23:55" → "00:00"); anything unreadable → the default. */
export function quarterHour(time: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return DEFAULT_TIME;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  if (hours >= HOURS_PER_DAY || minutes >= MINUTES_PER_HOUR) return DEFAULT_TIME;
  const total = Math.round((hours * MINUTES_PER_HOUR + minutes) / MINUTE_STEP) * MINUTE_STEP;
  const wrapped = total % (HOURS_PER_DAY * MINUTES_PER_HOUR);
  return `${pad(Math.floor(wrapped / MINUTES_PER_HOUR))}:${pad(wrapped % MINUTES_PER_HOUR)}`;
}

// The form shows a 12-hour clock: 1 to 12 plus a. m. / p. m.; it is stored as 24 hours.
export type Meridiem = "am" | "pm";
export const MERIDIEMS: readonly { id: Meridiem; label: string }[] = [
  { id: "am", label: "a. m." },
  { id: "pm", label: "p. m." },
];
const HALF_DAY = 12;
export const FIRST_CLOCK_HOUR = 1;
export const LAST_CLOCK_HOUR = 12;

/** "14:30" → 2, "30", p. m.; "00:15" → 12, "15", a. m. */
export function clockParts(time: string) {
  const [hours, minutes] = time.split(":");
  const hours24 = Number(hours);
  const meridiem: Meridiem = hours24 < HALF_DAY ? "am" : "pm";
  return { hour: hours24 % HALF_DAY || HALF_DAY, minutes, meridiem };
}

/** Back to "HH:MM" from the 12-hour clock: 12 a. m. is "00", 12 p. m. is "12". */
export function clockTime(hour: number, minutes: string, meridiem: Meridiem): string {
  const hours24 = (hour % HALF_DAY) + (meridiem === "pm" ? HALF_DAY : 0);
  return `${pad(hours24)}:${minutes}`;
}

/** "14:30" → "2:30 p. m.". */
export function clockLabel(time: string): string {
  const { hour, minutes, meridiem } = clockParts(time);
  return `${hour}:${minutes} ${MERIDIEMS.find((m) => m.id === meridiem)!.label}`;
}

export type DayPeriod = "day" | "afternoon" | "night";
const AFTERNOON_FROM = 12;
const NIGHT_FROM = 19;
const DAY_FROM = 6;

/** The part of the day a time falls in, for its icon: 6:00 day, 12:00 afternoon, 19:00 night. */
export function dayPeriod(time: string): DayPeriod {
  const hours24 = Number(time.split(":")[0]);
  if (hours24 >= DAY_FROM && hours24 < AFTERNOON_FROM) return "day";
  if (hours24 >= AFTERNOON_FROM && hours24 < NIGHT_FROM) return "afternoon";
  return "night";
}

/** "2026-11-05", local date. */
export const dateStamp = (at: Date) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

export const newSchedule = (id: string): BackupSchedule => ({
  id,
  name: DEFAULT_SCHEDULE_NAME,
  enabled: false,
  repeat: "daily",
  time: DEFAULT_TIME,
  weekdays: DEFAULT_WEEKDAYS,
  dayOfMonth: 1,
  date: null,
  notify: false,
  backup: null,
});

const isRepeat = (value: unknown): value is Repeat => REPEAT_OPTIONS.some((o) => o.id === value);
const isWeekday = (day: unknown): day is number => WEEKDAYS.some((w) => w.id === day);
const isDayOfMonth = (day: unknown): day is number => Number.isInteger(day) && (day as number) >= 1 && (day as number) <= MAX_DAY_OF_MONTH;

/** Known weekdays, once each and sorted; none → Monday. */
function cleanWeekdays(days: unknown): number[] {
  const known = Array.isArray(days) ? [...new Set(days.filter(isWeekday))].sort((a, b) => a - b) : [];
  return known.length ? known : DEFAULT_WEEKDAYS;
}

/** "AAAA-MM-DD" naming a real day: not 2026-02-30 nor 2026-13-01. */
export function isCalendarDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

const cleanDate = (date: unknown) => (isCalendarDate(date) ? date : null);

/** The day chosen for "Una vez", from today onwards: an earlier one becomes today, an invalid one nothing. */
export function upcomingDate(date: string, today: Date): string | null {
  if (!isCalendarDate(date)) return null;
  const first = dateStamp(today);
  return date < first ? first : date;
}

/** A saved schedule with what it lacks filled in, and anything it can't use put back to the default. */
export const withDefaults = (saved: Partial<BackupSchedule> & { id: string }): BackupSchedule => {
  const schedule = { ...newSchedule(saved.id), ...saved };
  return {
    ...schedule,
    repeat: isRepeat(schedule.repeat) ? schedule.repeat : "daily",
    time: quarterHour(schedule.time),
    weekdays: cleanWeekdays(schedule.weekdays),
    dayOfMonth: isDayOfMonth(schedule.dayOfMonth) ? schedule.dayOfMonth : 1,
    date: cleanDate(schedule.date),
  };
};

export const MANUAL_ONLY = "Manual: solo se hace con ▶";
export const DATE_REQUIRED = "Elige el día";
export const DATE_PASSED = "Ese día y hora ya pasaron";

/** "Una vez" on a day and time already gone: it would never run. */
export const oncePassed = (schedule: BackupSchedule, now: Date) =>
  schedule.repeat === "once" && !!schedule.date && `${schedule.date} ${schedule.time}` < `${dateStamp(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

export const MISSING_CONNECTION = "La conexión de este backup ya no existe";
export const RUNNING_NOW = "Se está haciendo ahora";
export const BACKUP_BUSY = "Ya hay un backup en curso: espera a que termine";
export const folderTaken = (other: BackupSchedule) => `“${other.name}” ya guarda sus copias en esa carpeta: cambia el nombre`;

/** What the blockers check a schedule against. */
export interface ScheduleContext {
  schedules: BackupSchedule[];
  /** Ids of the connections that still exist. */
  connectionIds: string[];
  /** The schedule whose backup is running: one at a time. */
  runningId: string | null;
}

/** Where a schedule's runs go, compared the way Windows does: separators alike and case ignored. */
function runsFolderKey(schedule: BackupSchedule): string | null {
  if (!schedule.backup) return null;
  const dir = schedule.backup.dir.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  return `${dir}/${folderSafeName(schedule.name)}`.toLowerCase();
}

/** Another schedule whose runs would land in the same folder: their copies would mix, and keeping 7 would delete the other's. */
export function folderTakenBy(schedule: BackupSchedule, schedules: BackupSchedule[]): BackupSchedule | undefined {
  const key = runsFolderKey(schedule);
  return key ? schedules.find((other) => other.id !== schedule.id && runsFolderKey(other) === key) : undefined;
}

/** What a schedule lacks to make its backup at all: what to save, its connection and a folder of its own. */
function setupBlocker(schedule: BackupSchedule, { schedules, connectionIds }: ScheduleContext): string | null {
  if (!schedule.backup) return BACKUP_REQUIRED;
  if (!connectionIds.includes(schedule.backup.sid)) return MISSING_CONNECTION;
  const other = folderTakenBy(schedule, schedules);
  return other ? folderTaken(other) : null;
}

/** Why ▶ can't run a schedule, if it can't: one backup at a time, and what it lacks. */
export function runBlocker(schedule: BackupSchedule, context: ScheduleContext): string | null {
  if (context.runningId) return context.runningId === schedule.id ? RUNNING_NOW : BACKUP_BUSY;
  return setupBlocker(schedule, context);
}

/** Why a schedule can't be turned on, if it can't: what it lacks, and a time it will never reach. A running backup doesn't stop it. */
export function enableBlocker(schedule: BackupSchedule, context: ScheduleContext, now: Date): string | null {
  const blocker = setupBlocker(schedule, context);
  if (blocker) return blocker;
  if (schedule.repeat === "manual") return MANUAL_ONLY;
  if (schedule.repeat === "once" && !schedule.date) return DATE_REQUIRED;
  if (oncePassed(schedule, now)) return DATE_PASSED;
  return null;
}

/** Switching frequency: "Una vez" starts on today when no day was chosen yet. */
export const repeatPatch = (schedule: BackupSchedule, repeat: Repeat, today: Date): Partial<BackupSchedule> =>
  repeat === "once" && !schedule.date ? { repeat, date: dateStamp(today) } : { repeat };

/** Turns a weekday on or off; the last one stays on, a weekly backup needs a day. */
export function toggleWeekday(days: number[], day: number): number[] {
  if (!days.includes(day)) return cleanWeekdays([...days, day]);
  return days.length > 1 ? days.filter((d) => d !== day) : days;
}

const atTime = (time: string) => `${clockParts(time).hour === 1 ? "a la" : "a las"} ${clockLabel(time)}`;
const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d, i) => d === b[i]);
const pluralOf = (day: number) => WEEKDAYS.find((w) => w.id === day)!.plural;
const shortOf = (day: number) => WEEKDAYS.find((w) => w.id === day)!.short;

/** "lunes, miércoles y viernes". */
function listOf(words: string[]): string {
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} y ${words[words.length - 1]}` : words[0];
}

/** "2026-11-05" → "05/11/2026". */
function localDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function weekdaysPhrase(days: number[]): string {
  if (days.length === WEEKDAYS.length) return "Todos los días";
  if (sameDays(days, WORKDAYS)) return "De lunes a viernes";
  if (sameDays(days, WEEKEND)) return "Los fines de semana";
  return `Los ${listOf(days.map(pluralOf))}`;
}

/** When it runs, in a sentence: "Los lunes y jueves a las 2:00 a. m.". */
export function repeatSummary(schedule: BackupSchedule): string {
  const { time } = schedule;
  switch (schedule.repeat) {
    case "daily":
      return `Todos los días ${atTime(time)}`;
    case "weekly":
      return `${weekdaysPhrase(schedule.weekdays)} ${atTime(time)}`;
    case "hourly": {
      const { minutes } = clockParts(time);
      return minutes === "00" ? "Cada hora en punto" : `Cada hora, a los ${Number(minutes)} minutos`;
    }
    case "monthly": {
      const shorter = schedule.dayOfMonth > DAYS_IN_EVERY_MONTH ? " (si el mes no tiene ese día, el último)" : "";
      return `El día ${schedule.dayOfMonth} de cada mes ${atTime(time)}${shorter}`;
    }
    case "once":
      return schedule.date ? `Solo el ${localDate(schedule.date)} ${atTime(time)}` : "Elige el día";
    case "manual":
      return "Solo cuando pulses ▶";
  }
}

const weekdaysShort = (days: number[]) => (sameDays(days, WORKDAYS) ? "L–V" : days.map(shortOf).join(""));

/** The same, short enough for the list: "LJ · 2:00 a. m.". */
export function repeatShort(schedule: BackupSchedule): string {
  const clock = clockLabel(schedule.time);
  switch (schedule.repeat) {
    case "daily":
      return clock;
    case "weekly":
      return schedule.weekdays.length === WEEKDAYS.length ? clock : `${weekdaysShort(schedule.weekdays)} · ${clock}`;
    case "hourly":
      return `cada hora · :${clockParts(schedule.time).minutes}`;
    case "monthly":
      return `día ${schedule.dayOfMonth} · ${clock}`;
    case "once":
      return schedule.date ? `${localDate(schedule.date).slice(0, 5)} · ${clock}` : "Una vez";
    case "manual":
      return "Manual";
  }
}

/** The copy starts off: it would otherwise run twice the same backup. */
export const duplicateSchedule = (schedule: BackupSchedule, id: string): BackupSchedule => ({
  ...schedule,
  id,
  name: `${schedule.name} (copia)`,
  enabled: false,
});

export const upsertSchedule = (list: BackupSchedule[], schedule: BackupSchedule): BackupSchedule[] =>
  list.some((s) => s.id === schedule.id) ? list.map((s) => (s.id === schedule.id ? schedule : s)) : [...list, schedule];

export const removeSchedule = (list: BackupSchedule[], id: string) => list.filter((s) => s.id !== id);

export function filterSchedules(list: BackupSchedule[], query: string): BackupSchedule[] {
  const q = query.trim().toLowerCase();
  return q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list;
}

/** "2 bases de datos · 35 colecciones". */
export const backupLabel = (backup: BackupRequest) =>
  `${databasesLabel(backup.databases.length)} · ${collectionsLabel(backup.databases.reduce((sum, d) => sum + d.collections.length, 0))}`;

/** Names Windows keeps for devices, with or without an extension: CON, NUL, COM1, LPT1.txt… */
const RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** The name as a folder name: characters Windows doesn't allow become "_", and a device name gets "_" in front. */
export function folderSafeName(name: string): string {
  const safe = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/[. ]+$/, "").trim() || DEFAULT_SCHEDULE_NAME;
  return RESERVED_NAME.test(safe) ? `_${safe}` : safe;
}

/** "2026-10-31_0230": a run's folder, sorted by date when listed by name. */
export const runStamp = (at: Date) => `${dateStamp(at)}_${pad(at.getHours())}${pad(at.getMinutes())}`;

/** Each run in its own folder (D16): `<dir>/<name>/<date>`, with the separator `dir` already uses. */
export function runFolder(dir: string, name: string, at: Date): string {
  const separator = dir.includes("\\") ? "\\" : "/";
  const base = dir.trim().replace(/[\\/]+$/, "");
  return [base, folderSafeName(name), runStamp(at)].join(separator);
}

/** The backup a run at `at` makes. Throws the message to show when nothing was chosen yet. */
export function runRequest(schedule: BackupSchedule, at: Date): BackupRequest {
  if (!schedule.backup) throw BACKUP_REQUIRED;
  return { ...schedule.backup, dir: runFolder(schedule.backup.dir, schedule.name, at) };
}

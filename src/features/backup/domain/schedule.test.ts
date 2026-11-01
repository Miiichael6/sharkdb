import { describe, expect, it } from "vitest";
import type { BackupRequest } from "./backupSpec";
import {
  BACKUP_BUSY,
  BACKUP_REQUIRED,
  DATE_PASSED,
  DATE_REQUIRED,
  DEFAULT_SCHEDULE_NAME,
  MANUAL_ONLY,
  MISSING_CONNECTION,
  RUNNING_NOW,
  DEFAULT_TIME,
  SCHEDULE_MINUTES,
  backupLabel,
  clockLabel,
  clockParts,
  clockTime,
  dayPeriod,
  duplicateSchedule,
  enableBlocker,
  filterSchedules,
  folderSafeName,
  folderTaken,
  folderTakenBy,
  isCalendarDate,
  newSchedule,
  quarterHour,
  removeSchedule,
  repeatPatch,
  repeatShort,
  repeatSummary,
  runBlocker,
  runFolder,
  runRequest,
  toggleWeekday,
  upcomingDate,
  upsertSchedule,
  withDefaults,
  type BackupSchedule,
} from "./schedule";

const BACKUP: BackupRequest = {
  sid: "qa",
  dir: "C:\\backups\\",
  databases: [
    { db: "shop", collections: ["orders", "users"] },
    { db: "log", collections: ["events"] },
  ],
};
const AT = new Date(2026, 9, 31, 2, 30);
const at = (patch: Partial<BackupSchedule>): BackupSchedule => ({ ...newSchedule("a"), ...patch });

describe("schedule", () => {
  it("only offers quarter hours", () => {
    expect(SCHEDULE_MINUTES).toEqual(["00", "15", "30", "45"]);
  });

  it("moves any time to the nearest quarter hour", () => {
    expect(quarterHour("14:43")).toBe("14:45");
    expect(quarterHour("14:37")).toBe("14:30");
    expect(quarterHour("9:07")).toBe("09:00");
    expect(quarterHour("12:30")).toBe("12:30");
    expect(quarterHour("23:55")).toBe("00:00");
  });

  it("falls back to the default time when it can't read one", () => {
    for (const time of ["", "mañana", "25:00", "10:75"]) expect(quarterHour(time)).toBe(DEFAULT_TIME);
  });

  it("fills a saved schedule's missing fields and fixes its time", () => {
    const saved = withDefaults({ id: "a", name: "Diario QA", time: "03:44" });
    expect(saved).toEqual({ ...newSchedule("a"), name: "Diario QA", time: "03:45" });
  });

  it("starts a copy off and named as a copy", () => {
    const copy = duplicateSchedule({ ...newSchedule("a"), enabled: true, backup: BACKUP }, "b");
    expect(copy).toMatchObject({ id: "b", name: `${DEFAULT_SCHEDULE_NAME} (copia)`, enabled: false, backup: BACKUP });
  });

  it("adds, replaces and removes schedules by id", () => {
    const a = newSchedule("a");
    const list = upsertSchedule(upsertSchedule([], a), newSchedule("b"));
    expect(upsertSchedule(list, { ...a, name: "x" }).map((s) => s.name)).toEqual(["x", DEFAULT_SCHEDULE_NAME]);
    expect(removeSchedule(list, "a").map((s) => s.id)).toEqual(["b"]);
  });

  it("filters by name ignoring case", () => {
    const list = [{ ...newSchedule("a"), name: "Diario QA" }, { ...newSchedule("b"), name: "Local" }];
    expect(filterSchedules(list, " qa ").map((s) => s.id)).toEqual(["a"]);
    expect(filterSchedules(list, "")).toBe(list);
  });

  it("labels what a backup saves", () => {
    expect(backupLabel(BACKUP)).toBe("2 bases de datos · 3 colecciones");
  });

  it("puts each run in a dated folder under the schedule's name", () => {
    expect(runFolder(BACKUP.dir, "Diario QA", AT)).toBe("C:\\backups\\Diario QA\\2026-10-31_0230");
    expect(runFolder("/home/me/b", "Diario", AT)).toBe("/home/me/b/Diario/2026-10-31_0230");
  });

  it("keeps folder names valid on Windows", () => {
    expect(folderSafeName('QA: "prod"/copia?')).toBe("QA_ _prod__copia_");
    expect(folderSafeName(" ... ")).toBe(DEFAULT_SCHEDULE_NAME);
    expect(folderSafeName("CON")).toBe("_CON");
    expect(folderSafeName("nul.backup")).toBe("_nul.backup");
    expect(folderSafeName("com1")).toBe("_com1");
    expect(folderSafeName("Consolidado")).toBe("Consolidado");
    expect(folderSafeName("COM10")).toBe("COM10");
  });

  it("runs the chosen backup into the run's folder, and needs one chosen", () => {
    const schedule = { ...newSchedule("a"), name: "Diario", backup: BACKUP };
    expect(runRequest(schedule, AT)).toEqual({ ...BACKUP, dir: "C:\\backups\\Diario\\2026-10-31_0230" });
    expect(() => runRequest(newSchedule("a"), AT)).toThrow(BACKUP_REQUIRED);
  });

  it("reads and writes a 24-hour time on a 12-hour clock", () => {
    expect(clockParts("00:15")).toEqual({ hour: 12, minutes: "15", meridiem: "am" });
    expect(clockParts("12:00")).toEqual({ hour: 12, minutes: "00", meridiem: "pm" });
    expect(clockParts("14:30")).toEqual({ hour: 2, minutes: "30", meridiem: "pm" });
    expect(clockTime(12, "15", "am")).toBe("00:15");
    expect(clockTime(12, "00", "pm")).toBe("12:00");
    expect(clockTime(2, "30", "pm")).toBe("14:30");
    expect(clockLabel("09:45")).toBe("9:45 a. m.");
  });

  it("tells day, afternoon and night apart", () => {
    expect(["05:45", "06:00", "11:45", "12:00", "18:45", "19:00"].map(dayPeriod)).toEqual([
      "night",
      "day",
      "day",
      "afternoon",
      "afternoon",
      "night",
    ]);
  });

  it("puts back what a saved schedule can't use", () => {
    const saved = withDefaults({ id: "a", repeat: "yearly" as never, weekdays: [5, 9, 1, 5], dayOfMonth: 40, date: "mañana" });
    expect(saved).toMatchObject({ repeat: "daily", weekdays: [1, 5], dayOfMonth: 1, date: null });
  });

  it("accepts only days that exist", () => {
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("2026-1-5")).toBe(false);
    expect(withDefaults({ id: "a", date: "2026-04-31" }).date).toBeNull();
  });

  it("chooses a one-off day from today onwards", () => {
    expect(upcomingDate("2026-11-05", AT)).toBe("2026-11-05");
    expect(upcomingDate("2026-10-31", AT)).toBe("2026-10-31");
    expect(upcomingDate("2025-01-01", AT)).toBe("2026-10-31");
    expect(upcomingDate("", AT)).toBeNull();
    expect(upcomingDate("2026-02-30", AT)).toBeNull();
  });

  it("says why a schedule can't be turned on", () => {
    const ready = at({ backup: BACKUP });
    const ctx = { schedules: [ready], connectionIds: ["qa"], runningId: null };
    expect(enableBlocker(at({}), ctx, AT)).toBe(BACKUP_REQUIRED);
    expect(enableBlocker(ready, { ...ctx, connectionIds: [] }, AT)).toBe(MISSING_CONNECTION);
    expect(enableBlocker({ ...ready, repeat: "manual" }, ctx, AT)).toBe(MANUAL_ONLY);
    expect(enableBlocker({ ...ready, repeat: "once", date: null }, ctx, AT)).toBe(DATE_REQUIRED);
    // Today at 2:00 is gone at 2:30; today at 2:30 and later still count.
    expect(enableBlocker({ ...ready, repeat: "once", date: "2026-10-31", time: "02:00" }, ctx, AT)).toBe(DATE_PASSED);
    expect(enableBlocker({ ...ready, repeat: "once", date: "2026-10-31", time: "02:30" }, ctx, AT)).toBeNull();
    expect(enableBlocker({ ...ready, repeat: "once", date: "2026-11-01", time: "00:00" }, ctx, AT)).toBeNull();
    expect(enableBlocker(ready, ctx, AT)).toBeNull();
  });

  it("lets ▶ run only what has a backup, its connection and a folder of its own", () => {
    const ready = at({ id: "a", name: "Ventas", backup: BACKUP, repeat: "manual" });
    const ctx = { schedules: [ready], connectionIds: ["qa"], runningId: null };
    expect(runBlocker(ready, ctx)).toBeNull();
    expect(runBlocker(at({}), ctx)).toBe(BACKUP_REQUIRED);
    expect(runBlocker(ready, { ...ctx, connectionIds: [] })).toBe(MISSING_CONNECTION);
    const twin = at({ id: "b", name: "ventas", backup: { ...BACKUP, dir: "c:/BACKUPS" } });
    expect(runBlocker(ready, { ...ctx, schedules: [ready, twin] })).toBe(folderTaken(twin));
  });

  it("runs one backup at a time, without stopping the switches", () => {
    const ready = at({ id: "a", backup: BACKUP });
    const ctx = { schedules: [ready], connectionIds: ["qa"], runningId: "b" };
    expect(runBlocker(ready, ctx)).toBe(BACKUP_BUSY);
    expect(runBlocker(ready, { ...ctx, runningId: "a" })).toBe(RUNNING_NOW);
    expect(runBlocker(at({ id: "c" }), ctx)).toBe(BACKUP_BUSY);
    expect(enableBlocker(ready, ctx, AT)).toBeNull();
  });

  it("finds another schedule saving into the same folder, as Windows compares them", () => {
    const a = at({ id: "a", name: "Ventas", backup: BACKUP });
    const sameAfterCleaning = at({ id: "b", name: "a/b", backup: BACKUP });
    const cleaned = at({ id: "c", name: "a_b", backup: { ...BACKUP, dir: "C:\\backups" } });
    expect(folderTakenBy(a, [a, at({ id: "b", name: "VENTAS ", backup: BACKUP })])?.id).toBe("b");
    expect(folderTakenBy(sameAfterCleaning, [a, sameAfterCleaning, cleaned])?.id).toBe("c");
    expect(folderTakenBy(a, [a, at({ id: "b", name: "Ventas", backup: { ...BACKUP, dir: "D:\backups" } })])).toBeUndefined();
    expect(folderTakenBy(a, [a, at({ id: "b", name: "Ventas" })])).toBeUndefined();
    expect(folderTakenBy(at({ name: "Ventas" }), [a])).toBeUndefined();
  });

  it("starts a one-off backup on today unless a day was chosen", () => {
    expect(repeatPatch(at({}), "once", AT)).toEqual({ repeat: "once", date: "2026-10-31" });
    expect(repeatPatch(at({ date: "2026-12-01" }), "once", AT)).toEqual({ repeat: "once" });
    expect(repeatPatch(at({}), "weekly", AT)).toEqual({ repeat: "weekly" });
  });

  it("keeps the weekdays sorted and never empty", () => {
    expect(toggleWeekday([1], 4)).toEqual([1, 4]);
    expect(toggleWeekday([4], 1)).toEqual([1, 4]);
    expect(toggleWeekday([1, 4], 1)).toEqual([4]);
    expect(toggleWeekday([4], 4)).toEqual([4]);
  });

  it("says when each frequency runs", () => {
    expect(repeatSummary(at({ time: "02:00" }))).toBe("Todos los días a las 2:00 a. m.");
    expect(repeatSummary(at({ time: "13:15" }))).toBe("Todos los días a la 1:15 p. m.");
    expect(repeatSummary(at({ repeat: "weekly", weekdays: [1, 4] }))).toBe("Los lunes y jueves a las 2:00 a. m.");
    expect(repeatSummary(at({ repeat: "weekly", weekdays: [1, 2, 3, 4, 5] }))).toBe("De lunes a viernes a las 2:00 a. m.");
    expect(repeatSummary(at({ repeat: "weekly", weekdays: [6, 7] }))).toBe("Los fines de semana a las 2:00 a. m.");
    expect(repeatSummary(at({ repeat: "hourly", time: "02:00" }))).toBe("Cada hora en punto");
    expect(repeatSummary(at({ repeat: "hourly", time: "02:15" }))).toBe("Cada hora, a los 15 minutos");
    expect(repeatSummary(at({ repeat: "monthly", dayOfMonth: 31 }))).toBe(
      "El día 31 de cada mes a las 2:00 a. m. (si el mes no tiene ese día, el último)",
    );
    expect(repeatSummary(at({ repeat: "once", date: "2026-11-05", time: "21:30" }))).toBe("Solo el 05/11/2026 a las 9:30 p. m.");
    expect(repeatSummary(at({ repeat: "manual" }))).toBe("Solo cuando pulses ▶");
  });

  it("says it short for the list", () => {
    expect(repeatShort(at({}))).toBe("2:00 a. m.");
    expect(repeatShort(at({ repeat: "weekly", weekdays: [1, 4] }))).toBe("LJ · 2:00 a. m.");
    expect(repeatShort(at({ repeat: "weekly", weekdays: [1, 2, 3, 4, 5] }))).toBe("L–V · 2:00 a. m.");
    expect(repeatShort(at({ repeat: "hourly", time: "02:45" }))).toBe("cada hora · :45");
    expect(repeatShort(at({ repeat: "monthly", dayOfMonth: 15 }))).toBe("día 15 · 2:00 a. m.");
    expect(repeatShort(at({ repeat: "once", date: "2026-11-05" }))).toBe("05/11 · 2:00 a. m.");
    expect(repeatShort(at({ repeat: "manual" }))).toBe("Manual");
  });
});

import { describe, expect, it } from "vitest";
import { newSchedule, type BackupSchedule } from "./schedule";
import { afterScheduledRun, dueRun, firstDue, isDue, momentLabel, nextRun, withArming } from "./scheduleTiming";

// Saturday 31 October 2026, local time.
const day = (d: number, h = 0, m = 0, month = 9, year = 2026) => new Date(year, month, d, h, m);
const NOW = day(31, 9, 0);
const on = (patch: Partial<BackupSchedule>): BackupSchedule => ({ ...newSchedule("a"), enabled: true, time: "02:00", ...patch });

describe("scheduleTiming · nextRun", () => {
  it("daily: today when the time is still ahead, tomorrow (across the month) when it passed", () => {
    expect(nextRun(on({ time: "14:30" }), NOW)).toEqual(day(31, 14, 30));
    expect(nextRun(on({}), NOW)).toEqual(day(1, 2, 0, 10));
    expect(nextRun(on({ time: "09:00" }), NOW)).toEqual(day(1, 9, 0, 10));
  });

  it("weekly: the next chosen weekday", () => {
    expect(nextRun(on({ repeat: "weekly", weekdays: [1, 4] }), NOW)).toEqual(day(2, 2, 0, 10));
    expect(nextRun(on({ repeat: "weekly", weekdays: [6], time: "10:00" }), NOW)).toEqual(day(31, 10, 0));
    expect(nextRun(on({ repeat: "weekly", weekdays: [6] }), NOW)).toEqual(day(7, 2, 0, 10));
  });

  it("monthly: day 31 runs on the last day of a 30-day month", () => {
    expect(nextRun(on({ repeat: "monthly", dayOfMonth: 31 }), NOW)).toEqual(day(30, 2, 0, 10));
    expect(nextRun(on({ repeat: "monthly", dayOfMonth: 31, time: "10:00" }), NOW)).toEqual(day(31, 10, 0));
    expect(nextRun(on({ repeat: "monthly", dayOfMonth: 30 }), day(1, 0, 0, 1))).toEqual(day(28, 2, 0, 1));
  });

  it("hourly: this hour's minutes or the next hour's, also past midnight", () => {
    expect(nextRun(on({ repeat: "hourly", time: "00:15" }), NOW)).toEqual(day(31, 9, 15));
    expect(nextRun(on({ repeat: "hourly", time: "00:00" }), NOW)).toEqual(day(31, 10, 0));
    expect(nextRun(on({ repeat: "hourly", time: "00:30" }), day(31, 23, 45))).toEqual(day(1, 0, 30, 10));
  });

  it("once: its day and time, nothing once gone", () => {
    expect(nextRun(on({ repeat: "once", date: "2026-11-05" }), NOW)).toEqual(day(5, 2, 0, 10));
    expect(nextRun(on({ repeat: "once", date: "2026-10-31" }), NOW)).toBeNull();
  });

  it("nothing when switched off or manual", () => {
    expect(nextRun(on({ enabled: false }), NOW)).toBeNull();
    expect(nextRun(on({ repeat: "manual" }), NOW)).toBeNull();
  });
});

describe("scheduleTiming · dueRun", () => {
  it("is due once today's time came, until it ran", () => {
    expect(dueRun(on({}), NOW)).toEqual(day(31, 2, 0));
    expect(isDue(on({ time: "10:00" }), NOW)).toBe(false);
    expect(isDue(on({ lastScheduledRun: day(31, 2, 0).toISOString() }), NOW)).toBe(false);
    expect(isDue(on({ lastScheduledRun: day(30, 2, 0).toISOString() }), NOW)).toBe(true);
  });

  it("at its exact minute, never twice in it", () => {
    expect(isDue(on({}), day(31, 2, 0))).toBe(true);
    expect(isDue(on({}), day(31, 1, 59))).toBe(false);
    expect(isDue(on({ lastScheduledRun: new Date(2026, 9, 31, 2, 0, 40).toISOString() }), day(31, 2, 0))).toBe(false);
  });

  it("a run missed today with the app closed is made when it opens, not one of yesterday (D15)", () => {
    expect(isDue(on({ time: "23:00" }), day(1, 8, 0, 10))).toBe(false);
    expect(isDue(on({ lastScheduledRun: day(29, 2, 0).toISOString() }), NOW)).toBe(true);
  });

  it("not for a time gone before it was switched on or re-timed", () => {
    expect(isDue(on({ armedAt: day(31, 8, 0).toISOString() }), NOW)).toBe(false);
    expect(isDue(on({ armedAt: day(30, 15, 0).toISOString() }), NOW)).toBe(true);
    expect(isDue(on({ armedAt: new Date(2026, 9, 31, 2, 0, 20).toISOString() }), NOW)).toBe(true);
  });

  it("weekly and monthly only on their day; once only on its date", () => {
    expect(isDue(on({ repeat: "weekly", weekdays: [6] }), NOW)).toBe(true);
    expect(isDue(on({ repeat: "weekly", weekdays: [1] }), NOW)).toBe(false);
    expect(isDue(on({ repeat: "monthly", dayOfMonth: 31 }), NOW)).toBe(true);
    expect(isDue(on({ repeat: "monthly", dayOfMonth: 31 }), day(30, 9, 0, 10))).toBe(true);
    expect(isDue(on({ repeat: "once", date: "2026-10-31" }), NOW)).toBe(true);
    expect(isDue(on({ repeat: "once", date: "2026-10-30" }), NOW)).toBe(false);
  });

  it("hourly: the latest hour's minutes, not yesterday's", () => {
    expect(dueRun(on({ repeat: "hourly", time: "00:45" }), NOW)).toEqual(day(31, 8, 45));
    expect(isDue(on({ repeat: "hourly", time: "00:45", lastScheduledRun: day(31, 8, 45).toISOString() }), NOW)).toBe(false);
    expect(isDue(on({ repeat: "hourly", time: "00:30" }), day(1, 0, 10, 10))).toBe(false);
  });

  it("never when switched off or manual", () => {
    expect(isDue(on({ enabled: false }), NOW)).toBe(false);
    expect(isDue(on({ repeat: "manual" }), NOW)).toBe(false);
  });

  it("finds the first due schedule in list order", () => {
    const later = on({ id: "later", time: "10:00" });
    expect(firstDue([later, on({ id: "b" }), on({ id: "c" })], NOW)?.id).toBe("b");
    expect(firstDue([later], NOW)).toBeUndefined();
  });
});

describe("scheduleTiming · after a run and edits", () => {
  it("remembers the run and switches off a once schedule", () => {
    expect(afterScheduledRun(on({}), NOW)).toMatchObject({ enabled: true, lastScheduledRun: NOW.toISOString() });
    expect(afterScheduledRun(on({ repeat: "once", date: "2026-10-31" }), NOW).enabled).toBe(false);
  });

  it("re-arms when switched on or re-timed while on, not for other edits", () => {
    const armed = { armedAt: NOW.toISOString() };
    expect(withArming(on({ enabled: false }), { enabled: true }, NOW)).toEqual({ enabled: true, ...armed });
    expect(withArming(on({}), { time: "03:00" }, NOW)).toEqual({ time: "03:00", ...armed });
    expect(withArming(on({}), { name: "QA" }, NOW)).toEqual({ name: "QA" });
    expect(withArming(on({ enabled: false }), { time: "03:00" }, NOW)).toEqual({ time: "03:00" });
  });

  it("labels a moment like the rest of the form", () => {
    expect(momentLabel(day(5, 14, 30, 10))).toBe("05/11/2026 2:30 p. m.");
  });
});

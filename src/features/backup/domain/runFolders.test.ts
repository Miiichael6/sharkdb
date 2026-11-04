import { describe, expect, it } from "vitest";
import type { BackupRequest } from "./backupSpec";
import { RECENT_UNFINISHED_MS, RETAINED_RUNS, isRunName, runFolder, runRequest, runStamp, runsParent, runsToDelete } from "./runFolders";
import { BACKUP_REQUIRED, NOTHING_LEFT, newSchedule } from "./schedule";

const BACKUP: BackupRequest = { sid: "qa", dir: "C:\\backups\\", databases: [{ db: "shop", collections: ["orders"] }] };
const AT = new Date(2026, 9, 31, 2, 30);
/** Long after every run of these tests: none is recent. */
const LATER = new Date(2026, 11, 31);
const CATALOG = [{ name: "shop", sizeOnDisk: 0, collections: ["orders", "users"] }];
const done = (name: string) => ({ name, complete: true });
const cut = (name: string) => ({ name, complete: false });

describe("runFolders", () => {
  it("puts each run in a dated folder under the schedule's name", () => {
    expect(runsParent(BACKUP.dir, "Diario QA")).toBe("C:\\backups\\Diario QA");
    expect(runStamp(AT)).toBe("2026-10-31_0230");
    expect(runFolder("C:\\backups\\Diario QA", "2026-10-31_0230_2")).toBe("C:\\backups\\Diario QA\\2026-10-31_0230_2");
    expect(runFolder("/home/me/b/Diario", "2026-10-31_0230")).toBe("/home/me/b/Diario/2026-10-31_0230");
  });

  it("runs the chosen backup into the schedule's folder, and needs one chosen", () => {
    const schedule = { ...newSchedule("a"), name: "Diario", backup: BACKUP };
    expect(runRequest(schedule, CATALOG)).toEqual({ request: { ...BACKUP, dir: "C:\\backups\\Diario" }, missing: [] });
    expect(() => runRequest(newSchedule("a"), CATALOG)).toThrow(BACKUP_REQUIRED);
  });

  it("runs a whole database with the collections it has now, and fails only when nothing is left (error 47)", () => {
    const whole = { ...BACKUP, databases: [{ db: "shop", collections: ["orders"], complete: true }] };
    const schedule = { ...newSchedule("a"), name: "Diario", backup: whole };
    expect(runRequest(schedule, CATALOG).request.databases).toEqual([
      { db: "shop", collections: ["orders", "users"], complete: true },
    ]);
    expect(() => runRequest(schedule, [])).toThrow(NOTHING_LEFT);
  });

  it("only recognizes the folders runs make", () => {
    expect(["2026-10-31_0230", "2026-10-31_0230_2"].every(isRunName)).toBe(true);
    expect(["notas", "2026-10-31", "2026-10-31_0230_", "x2026-10-31_0230"].some(isRunName)).toBe(false);
  });

  it("keeps the newest runs and deletes the rest, oldest first", () => {
    const runs = Array.from({ length: 9 }, (_, i) => `2026-10-${String(20 + i).padStart(2, "0")}_0200`);
    expect(runsToDelete([...runs].reverse().map(done), LATER)).toEqual(runs.slice(0, 9 - RETAINED_RUNS));
    expect(runsToDelete(runs.slice(0, RETAINED_RUNS).map(done), LATER)).toEqual([]);
  });

  it("orders runs of the same minute by their suffix and ignores other folders", () => {
    const names = ["2026-10-31_0230_10", "notas", "2026-10-31_0230_2", "2026-10-31_0230", "2026-10-31_0231"];
    expect(runsToDelete(names.map(done), LATER, 2)).toEqual(["2026-10-31_0230", "2026-10-31_0230_2"]);
  });

  it("never lets unfinished runs take the place of complete ones (error 46)", () => {
    const good = Array.from({ length: 7 }, (_, i) => `2026-10-1${i}_0200`);
    const failed = Array.from({ length: 6 }, (_, i) => `2026-10-2${i}_0200`);
    const folders = [...good.map(done), ...failed.map(cut), done("2026-10-30_0200")];
    expect(runsToDelete(folders, LATER)).toEqual([good[0], ...failed]);
  });

  it("keeps unfinished runs newer than the last complete one: they may still be running", () => {
    const folders = [cut("2026-10-30_0200"), done("2026-10-31_0200"), cut("2026-10-31_0300")];
    expect(runsToDelete(folders, LATER)).toEqual(["2026-10-30_0200"]);
    expect(runsToDelete([cut("2026-10-30_0200")], LATER)).toEqual([]);
  });

  it("keeps unfinished runs started recently: another window may still be writing them (error 60)", () => {
    const folders = [cut("2026-10-31_0230"), done("2026-10-31_0230_2")];
    expect(runsToDelete(folders, AT)).toEqual([]);
    expect(runsToDelete(folders, new Date(AT.getTime() + RECENT_UNFINISHED_MS - 1))).toEqual([]);
    expect(runsToDelete(folders, new Date(AT.getTime() + RECENT_UNFINISHED_MS))).toEqual(["2026-10-31_0230"]);
  });
});

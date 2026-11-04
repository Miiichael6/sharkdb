import { describe, expect, it } from "vitest";
import type { BackupRequest } from "./backupSpec";
import { RETAINED_RUNS, isRunName, runFolder, runName, runRequest, runsParent, runsToDelete } from "./runFolders";
import { BACKUP_REQUIRED, NOTHING_LEFT, newSchedule } from "./schedule";

const BACKUP: BackupRequest = { sid: "qa", dir: "C:\\backups\\", databases: [{ db: "shop", collections: ["orders"] }] };
const AT = new Date(2026, 9, 31, 2, 30);
const CATALOG = [{ name: "shop", sizeOnDisk: 0, collections: ["orders", "users"] }];
const done = (name: string) => ({ name, complete: true });
const cut = (name: string) => ({ name, complete: false });

describe("runFolders", () => {
  it("puts each run in a dated folder under the schedule's name", () => {
    expect(runsParent(BACKUP.dir, "Diario QA")).toBe("C:\\backups\\Diario QA");
    expect(runFolder(BACKUP.dir, "Diario QA", AT)).toBe("C:\\backups\\Diario QA\\2026-10-31_0230");
    expect(runFolder("/home/me/b", "Diario", AT)).toBe("/home/me/b/Diario/2026-10-31_0230");
  });

  it("gives a second run of the same minute a folder of its own", () => {
    expect(runName(AT, ["2026-10-31_0215"])).toBe("2026-10-31_0230");
    expect(runName(AT, ["2026-10-31_0230"])).toBe("2026-10-31_0230_2");
    expect(runName(AT, ["2026-10-31_0230", "2026-10-31_0230_2"])).toBe("2026-10-31_0230_3");
  });

  it("runs the chosen backup into the run's folder, and needs one chosen", () => {
    const schedule = { ...newSchedule("a"), name: "Diario", backup: BACKUP };
    expect(runRequest(schedule, AT, CATALOG)).toEqual({
      request: { ...BACKUP, dir: "C:\\backups\\Diario\\2026-10-31_0230" },
      missing: [],
    });
    expect(runRequest(schedule, AT, CATALOG, ["2026-10-31_0230"]).request.dir).toBe("C:\\backups\\Diario\\2026-10-31_0230_2");
    expect(() => runRequest(newSchedule("a"), AT, CATALOG)).toThrow(BACKUP_REQUIRED);
  });

  it("runs a whole database with the collections it has now, and fails only when nothing is left (error 47)", () => {
    const whole = { ...BACKUP, databases: [{ db: "shop", collections: ["orders"], complete: true }] };
    const schedule = { ...newSchedule("a"), name: "Diario", backup: whole };
    expect(runRequest(schedule, AT, CATALOG).request.databases).toEqual([
      { db: "shop", collections: ["orders", "users"], complete: true },
    ]);
    expect(() => runRequest(schedule, AT, [])).toThrow(NOTHING_LEFT);
  });

  it("only recognizes the folders runs make", () => {
    expect(["2026-10-31_0230", "2026-10-31_0230_2"].every(isRunName)).toBe(true);
    expect(["notas", "2026-10-31", "2026-10-31_0230_", "x2026-10-31_0230"].some(isRunName)).toBe(false);
  });

  it("keeps the newest runs and deletes the rest, oldest first", () => {
    const runs = Array.from({ length: 9 }, (_, i) => `2026-10-${String(20 + i).padStart(2, "0")}_0200`);
    expect(runsToDelete([...runs].reverse().map(done))).toEqual(runs.slice(0, 9 - RETAINED_RUNS));
    expect(runsToDelete(runs.slice(0, RETAINED_RUNS).map(done))).toEqual([]);
  });

  it("orders runs of the same minute by their suffix and ignores other folders", () => {
    const names = ["2026-10-31_0230_10", "notas", "2026-10-31_0230_2", "2026-10-31_0230", "2026-10-31_0231"];
    expect(runsToDelete(names.map(done), 2)).toEqual(["2026-10-31_0230", "2026-10-31_0230_2"]);
  });

  it("never lets unfinished runs take the place of complete ones (error 46)", () => {
    const good = Array.from({ length: 7 }, (_, i) => `2026-10-1${i}_0200`);
    const failed = Array.from({ length: 6 }, (_, i) => `2026-10-2${i}_0200`);
    const folders = [...good.map(done), ...failed.map(cut), done("2026-10-30_0200")];
    expect(runsToDelete(folders)).toEqual([good[0], ...failed]);
  });

  it("keeps unfinished runs newer than the last complete one: they may still be running", () => {
    const folders = [cut("2026-10-30_0200"), done("2026-10-31_0200"), cut("2026-10-31_0300")];
    expect(runsToDelete(folders)).toEqual(["2026-10-30_0200"]);
    expect(runsToDelete([cut("2026-10-30_0200")])).toEqual([]);
  });
});

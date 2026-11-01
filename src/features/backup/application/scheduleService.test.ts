import { describe, expect, it } from "vitest";
import type { Operation, OperationStatus } from "../../../shared/domain/operations";
import type { SystemAlert } from "../domain/runAlert";
import { newSchedule, type BackupSchedule } from "../domain/schedule";
import type { RunFolders, ScheduleStore } from "./ports";
import { createScheduleService } from "./scheduleService";

const AT = new Date(2026, 9, 31, 2, 30);
const DAILY: BackupSchedule = {
  ...newSchedule("a"),
  name: "Diario",
  backup: { sid: "qa", dir: "/backups", databases: [{ db: "shop", collections: ["orders"] }] },
};

function fakes(saved: Awaited<ReturnType<ScheduleStore["load"]>> = [], folders: Record<string, string[]> = {}) {
  let file = saved;
  const alerts: SystemAlert[] = [];
  const store: ScheduleStore = {
    load: async () => file,
    save: async (schedules) => {
      file = schedules;
    },
  };
  const runs: RunFolders = {
    list: async (parent) => folders[parent] ?? [],
    remove: async (parent, names) => {
      folders[parent] = folders[parent].filter((n) => !names.includes(n));
    },
  };
  const service = createScheduleService({
    store,
    runs,
    notifier: { show: async (alert) => void alerts.push(alert) },
    clock: { onMinute: async () => () => {} },
  });
  return { service, file: () => file, folders, alerts };
}

const ended = (status: OperationStatus, summary = "Backup listo", error = ""): Operation => ({
  id: "op",
  kind: "backup",
  title: "Backup",
  source: { name: "QA" },
  target: { name: "2026-10-31_0230" },
  status,
  progress: null,
  results: [],
  summary,
  error,
  startedAt: 0,
  endedAt: 1,
});

describe("scheduleService", () => {
  it("lists saved schedules complete and on quarter hours", async () => {
    const { service } = fakes([{ id: "a", name: "QA", time: "02:44" }]);
    expect(await service.list()).toEqual([{ ...newSchedule("a"), name: "QA", time: "02:45" }]);
  });

  it("saves the whole list", async () => {
    const { service, file } = fakes();
    const schedules: BackupSchedule[] = [newSchedule("a"), newSchedule("b")];
    await service.save(schedules);
    expect(file()).toEqual(schedules);
  });

  it("gives a run of a minute already used its own folder", async () => {
    const { service } = fakes([], { "/backups/Diario": ["2026-10-31_0230"] });
    expect((await service.runRequest(DAILY, AT)).dir).toBe("/backups/Diario/2026-10-31_0230_2");
  });

  it("deletes the oldest runs past the last 7, never other folders", async () => {
    const runs = Array.from({ length: 9 }, (_, i) => `2026-10-2${i}_0200`);
    const { service, folders } = fakes([], { "/backups/Diario": ["notas", ...runs] });
    expect(await service.prune(DAILY)).toEqual(runs.slice(0, 2));
    expect(folders["/backups/Diario"]).toEqual(["notas", ...runs.slice(2)]);
    expect(await service.prune(newSchedule("b"))).toEqual([]);
  });

  it("alerts the system when asked to, and always on a failure", async () => {
    const { service, alerts } = fakes();
    await service.alertEnded(DAILY, ended("done"));
    await service.alertEnded({ ...DAILY, notify: true }, ended("done"));
    await service.alertEnded(DAILY, ended("failed", "", "sin espacio"));
    await service.alertNotStarted(DAILY, "La conexión ya no existe");
    expect(alerts).toEqual([
      { title: "Backup “Diario”", body: "Backup listo" },
      { title: "Backup “Diario”", body: "Backup QA → 2026-10-31_0230 falló: sin espacio" },
      { title: "Backup “Diario”", body: "No se pudo hacer: La conexión ya no existe" },
    ]);
  });
});

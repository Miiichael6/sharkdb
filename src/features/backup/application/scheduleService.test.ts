import { describe, expect, it } from "vitest";
import { newSchedule, type BackupSchedule } from "../domain/schedule";
import type { ScheduleStore } from "./ports";
import { createScheduleService } from "./scheduleService";

function fakeStore(saved: Awaited<ReturnType<ScheduleStore["load"]>>) {
  let file = saved;
  const store: ScheduleStore = {
    load: async () => file,
    save: async (schedules) => {
      file = schedules;
    },
  };
  return { store, file: () => file };
}

describe("scheduleService", () => {
  it("lists saved schedules complete and on quarter hours", async () => {
    const { store } = fakeStore([{ id: "a", name: "QA", time: "02:44" }]);
    expect(await createScheduleService(store).list()).toEqual([{ ...newSchedule("a"), name: "QA", time: "02:45" }]);
  });

  it("saves the whole list", async () => {
    const { store, file } = fakeStore([]);
    const schedules: BackupSchedule[] = [newSchedule("a"), newSchedule("b")];
    await createScheduleService(store).save(schedules);
    expect(file()).toEqual(schedules);
  });
});

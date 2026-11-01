import { filterSchedules } from "../domain/schedule";
import { ScheduleForm } from "./ScheduleForm";
import { ScheduleList } from "./ScheduleList";
import type { BackupSchedules } from "./useBackupSchedules";

/** The two panes of the "Backups" screen: the list on the left and the selected schedule on the right. */
export function renderSchedules(s: BackupSchedules, query: string) {
  const visible = filterSchedules(s.schedules, query);
  return {
    side: (
      <ScheduleList
        schedules={visible}
        selectedId={s.selected?.id ?? null}
        running={s.schedules.find((schedule) => schedule.id === s.runningId) ?? null}
        filtered={s.schedules.length > 0}
        onSelect={s.select}
        onToggle={(schedule, enabled) => s.change(schedule.id, { enabled })}
        onRun={(schedule) => void s.runNow(schedule)}
        onDuplicate={s.duplicate}
        onDelete={(schedule) => void s.remove(schedule)}
        onCancelRun={s.cancelRun}
        enableBlockerOf={s.enableBlockerOf}
        runBlockerOf={s.runBlockerOf}
      />
    ),
    main: (
      <ScheduleForm
        schedule={s.selected}
        connection={s.selected ? s.connectionOf(s.selected) : undefined}
        folderTakenBy={s.selected ? s.folderTakenBy(s.selected) : undefined}
        onChange={(patch) => s.selected && s.change(s.selected.id, patch)}
        onChooseWhat={() => s.selected && void s.chooseWhat(s.selected)}
        onOpenFolder={s.openFolder}
      />
    ),
  };
}

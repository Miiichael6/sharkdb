import { NumberStepper } from "../../../shared/ui/NumberStepper";
import { SegmentedControl } from "../../../shared/ui/SegmentedControl";
import {
  DATE_PASSED,
  MAX_DAY_OF_MONTH,
  REPEAT_OPTIONS,
  dateStamp,
  oncePassed,
  repeatPatch,
  repeatSummary,
  upcomingDate,
  type BackupSchedule,
} from "../domain/schedule";
import { TimeField } from "./TimeField";
import { WeekdayPicker } from "./WeekdayPicker";

interface Props {
  schedule: BackupSchedule;
  onChange: (patch: Partial<BackupSchedule>) => void;
}

/** When a schedule runs: the frequency, what that frequency needs (days, day of the month, date, time) and the result in words. */
export function RepeatFields({ schedule, onChange }: Props) {
  const { repeat } = schedule;
  return (
    <>
      <div className="schedule-row stacked">
        <span>Repetir</span>
        <SegmentedControl
          segments={REPEAT_OPTIONS}
          value={repeat}
          onChange={(r) => onChange(repeatPatch(schedule, r, new Date()))}
          label="Frecuencia"
          className="repeat-control"
        />
      </div>
      {repeat === "weekly" && (
        <div className="schedule-row">
          <span>Días</span>
          <WeekdayPicker days={schedule.weekdays} onChange={(weekdays) => onChange({ weekdays })} />
        </div>
      )}
      {repeat === "monthly" && (
        <div className="schedule-row">
          <span>Día del mes</span>
          <NumberStepper
            value={schedule.dayOfMonth}
            min={1}
            max={MAX_DAY_OF_MONTH}
            onChange={(dayOfMonth) => onChange({ dayOfMonth })}
            label="Día del mes"
          />
        </div>
      )}
      {repeat === "once" && (
        <label className="schedule-row">
          <span>Día</span>
          <input
            type="date"
            className="schedule-date"
            min={dateStamp(new Date())}
            value={schedule.date ?? ""}
            onChange={(e) => onChange({ date: upcomingDate(e.target.value, new Date()) })}
          />
        </label>
      )}
      {repeat !== "manual" && (
        <div className="schedule-row">
          <span>{repeat === "hourly" ? "Minuto" : "Hora"}</span>
          <TimeField time={schedule.time} onChange={(time) => onChange({ time })} minutesOnly={repeat === "hourly"} />
        </div>
      )}
      {oncePassed(schedule, new Date()) && <p className="test error small">{DATE_PASSED}</p>}
      <p className="schedule-summary">{repeatSummary(schedule)}</p>
    </>
  );
}

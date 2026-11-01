import { NumberStepper } from "../../../shared/ui/NumberStepper";
import { SegmentedControl } from "../../../shared/ui/SegmentedControl";
import {
  FIRST_CLOCK_HOUR,
  LAST_CLOCK_HOUR,
  MERIDIEMS,
  SCHEDULE_MINUTES,
  clockParts,
  clockTime,
  dayPeriod,
} from "../domain/schedule";
import { DayPeriodIcon } from "./DayPeriodIcon";

const MINUTE_SEGMENTS = SCHEDULE_MINUTES.map((m) => ({ id: m, label: m }));

interface Props {
  /** "HH:MM", 24 hours. */
  time: string;
  onChange: (time: string) => void;
  /** "Cada hora" chooses only the minutes. */
  minutesOnly?: boolean;
}

/** The time on a 12-hour clock: the hour 1 to 12, the quarter, a. m. / p. m. and whether it's day, afternoon or night. */
export function TimeField({ time, onChange, minutesOnly = false }: Props) {
  const { hour, minutes, meridiem } = clockParts(time);
  const minutesControl = (
    <>
      <span className="time-colon" aria-hidden>
        :
      </span>
      <SegmentedControl segments={MINUTE_SEGMENTS} value={minutes} onChange={(m) => onChange(clockTime(hour, m, meridiem))} label="Minutos" />
    </>
  );
  if (minutesOnly) return <div className="time-field">{minutesControl}</div>;
  return (
    <div className="time-field">
      <DayPeriodIcon period={dayPeriod(time)} />
      <NumberStepper
        value={hour}
        min={FIRST_CLOCK_HOUR}
        max={LAST_CLOCK_HOUR}
        onChange={(h) => onChange(clockTime(h, minutes, meridiem))}
        label="Hora"
      />
      {minutesControl}
      <SegmentedControl segments={MERIDIEMS} value={meridiem} onChange={(m) => onChange(clockTime(hour, minutes, m))} label="a. m. o p. m." />
    </div>
  );
}

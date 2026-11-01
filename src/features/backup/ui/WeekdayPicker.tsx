import { WEEKDAYS, toggleWeekday } from "../domain/schedule";

interface Props {
  days: number[];
  onChange: (days: number[]) => void;
}

/** L M X J V S D: the days a weekly backup runs on; at least one stays chosen. */
export function WeekdayPicker({ days, onChange }: Props) {
  return (
    <div className="weekday-picker" role="group" aria-label="Días">
      {WEEKDAYS.map((w) => (
        <button
          key={w.id}
          type="button"
          title={w.plural}
          aria-label={w.plural}
          aria-pressed={days.includes(w.id)}
          onClick={() => onChange(toggleWeekday(days, w.id))}
        >
          {w.short}
        </button>
      ))}
    </div>
  );
}

/** Color of a value of a CycleButton. */
export type CycleTone = "red" | "amber" | "green";

export interface CycleOption<T extends string> {
  value: T;
  tone: CycleTone;
}

interface Props<T extends string> {
  /** The values it goes through, in order; after the last it goes back to the first. */
  options: CycleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What the value is about, for screen readers ("Nivel"). */
  label: string;
  disabled?: boolean;
}

/** Pill that shows the current value in its color; a click moves to the next one. */
export function CycleButton<T extends string>({ options, value, onChange, label, disabled }: Props<T>) {
  const current = Math.max(options.findIndex((o) => o.value === value), 0);
  const next = options[(current + 1) % options.length].value;
  return (
    <button
      type="button"
      className={`cycle-button tone-${options[current].tone}`}
      onClick={() => onChange(next)}
      disabled={disabled}
      aria-label={`${label}: ${value}`}
      title={disabled ? undefined : `Clic para cambiar a ${next}`}
    >
      <span className="cycle-icon" aria-hidden="true">
        ⟳
      </span>
      {value}
    </button>
  );
}

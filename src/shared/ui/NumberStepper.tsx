interface Props {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}

/** − value +, wrapping around past either end (12 → 1); the arrow keys step it too. */
export function NumberStepper({ value, min, max, onChange, label }: Props) {
  const span = max - min + 1;
  const step = (by: number) => onChange(((((value - min + by) % span) + span) % span) + min);
  return (
    <div
      className="stepper"
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") step(1);
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft") step(-1);
        else return;
        e.preventDefault();
      }}
    >
      <button type="button" tabIndex={-1} aria-label="Menos" onClick={() => step(-1)}>
        −
      </button>
      <span className="stepper-value">{value}</span>
      <button type="button" tabIndex={-1} aria-label="Más" onClick={() => step(1)}>
        +
      </button>
    </div>
  );
}

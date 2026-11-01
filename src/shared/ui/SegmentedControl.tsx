import type { CSSProperties, ReactNode } from "react";

export interface Segment<Id> {
  id: Id;
  label: ReactNode;
  /** Tooltip and accessible name, for segments that show only an icon. */
  title?: string;
}

interface Props<Id> {
  segments: readonly Segment<Id>[];
  value: Id;
  onChange: (id: Id) => void;
  label: string;
  className?: string;
}

/**
 * Equal buttons on a rounded track whose highlight slides to the chosen one, as the shell tabs' pill
 * does. Stays mounted while `value` changes, or the highlight would jump instead of slide.
 */
export function SegmentedControl<Id extends string | number>({ segments, value, onChange, label, className = "" }: Props<Id>) {
  const index = segments.findIndex((s) => s.id === value);
  const track = { "--count": segments.length } as CSSProperties;
  return (
    <div className={`segment-track ${className}`} role="group" aria-label={label} style={track}>
      <span className="segment-pill" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden />
      {segments.map((s) => (
        <button
          key={s.id}
          type="button"
          title={s.title}
          aria-label={s.title}
          aria-pressed={s.id === value}
          onClick={() => onChange(s.id)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

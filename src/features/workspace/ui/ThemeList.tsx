import type { KeyboardEvent } from "react";

interface Props<Id extends string> {
  label: string;
  options: readonly { id: Id; label: string }[];
  value: Id;
  onChange: (id: Id) => void;
  autoFocus?: boolean;
}

/** One list of the "Tema" window: the active theme marked; a click or the arrows pick another. */
export function ThemeList<Id extends string>({ label, options, value, onChange, autoFocus }: Props<Id>) {
  const index = options.findIndex((o) => o.id === value);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    const next =
      e.key === "ArrowDown" ? Math.min(index + 1, last)
      : e.key === "ArrowUp" ? Math.max(index - 1, 0)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    onChange(options[next].id);
  };

  return (
    <section className="theme-list">
      <h4 id={`theme-list-${label}`}>{label}</h4>
      <ul
        role="listbox"
        aria-labelledby={`theme-list-${label}`}
        aria-activedescendant={`theme-${label}-${value}`}
        tabIndex={0}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
      >
        {options.map((o) => (
          <li
            key={o.id}
            id={`theme-${label}-${o.id}`}
            role="option"
            aria-selected={o.id === value}
            className={o.id === value ? "active" : undefined}
            onClick={() => onChange(o.id)}
          >
            <CheckIcon visible={o.id === value} />
            {o.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CheckIcon({ visible }: { visible: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden style={{ visibility: visible ? "visible" : "hidden" }}>
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { Modal } from "./common";

export interface PaletteItem {
  id: string;
  label: string;
  detail?: string;
  hint?: string;
  title?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

interface Props {
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  /** Already filtered and ordered for `query`. */
  items: PaletteItem[];
  onPick: (item: PaletteItem) => void;
  onClose: () => void;
  /** Shown when `items` is empty. */
  emptyText?: string;
}

const firstEnabled = (items: PaletteItem[]) => Math.max(0, items.findIndex((i) => !i.disabled));

/** Search box over a list: the arrows move, Enter picks, Escape (or a click outside) closes. */
export function CommandPalette({ label, placeholder, query, onQueryChange, items, onPick, onClose, emptyText }: Props) {
  const listId = useId();
  const [active, setActive] = useState(() => firstEnabled(items));
  // A new query means a new list; a re-render with the same query keeps the highlighted item.
  useEffect(() => setActive(firstEnabled(items)), [query]);

  const move = (step: number) => {
    for (let i = active + step; i >= 0 && i < items.length; i += step) {
      if (!items[i].disabled) return setActive(i);
    }
  };

  const pick = (item: PaletteItem | undefined) => item && !item.disabled && onPick(item);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "Enter") pick(items[active]);
    else return;
    e.preventDefault();
  };

  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <Modal className="palette" onClose={onClose}>
      <input
        autoFocus
        className="palette-input"
        aria-label={label}
        placeholder={placeholder}
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={items.length ? optionId(active) : undefined}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <ul className="palette-list" id={listId} role="listbox" aria-label={label}>
        {items.map((item, i) => (
          <li
            key={item.id}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            aria-disabled={item.disabled}
            title={item.title}
            className={`palette-item${i === active ? " active" : ""}`}
            onMouseMove={() => !item.disabled && setActive(i)}
            onClick={() => pick(item)}
          >
            {item.icon && <span className="palette-icon">{item.icon}</span>}
            <span className="palette-label">{item.label}</span>
            {item.detail && <span className="palette-detail">{item.detail}</span>}
            {item.hint && <span className="palette-hint">{item.hint}</span>}
          </li>
        ))}
        {!items.length && <li className="palette-empty">{emptyText ?? "Sin resultados"}</li>}
      </ul>
    </Modal>
  );
}

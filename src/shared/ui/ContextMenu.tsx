import { Fragment, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useFitInWindow } from "./useFitInWindow";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Shortcut shown on the right, e.g. "Ctrl+O". */
  hint?: string;
  /** Marks the current choice in a menu used as a picker. */
  checked?: boolean;
  icon?: ReactNode;
  /** Draws a separator line above this item. */
  separatorBefore?: boolean;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  label?: string;
}

/**
 * Floating menu at the pointer; any click elsewhere, Escape or leaving the window closes it.
 * It takes the focus, so the arrow keys move through the items and Enter picks one.
 */
export function ContextMenu({ x, y, items, onClose, label }: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("click", onClose);
    window.addEventListener("blur", onClose);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClose);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useFitInWindow(listRef, x, y);
  // One item with an icon keeps a column for icons, so every label lines up.
  const withIcons = items.some((item) => item.icon);

  const enabledItems = () => [...(listRef.current?.querySelectorAll<HTMLLIElement>('li[role^="menuitem"]:not(.disabled)') ?? [])];

  useEffect(() => {
    const all = enabledItems();
    (all.find((li) => li.getAttribute("aria-checked") === "true") ?? all[0])?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    const all = enabledItems();
    const i = all.indexOf(document.activeElement as HTMLLIElement);
    switch (e.key) {
      case "ArrowDown":
        all[(i + 1) % all.length]?.focus();
        break;
      case "ArrowUp":
        all[(i - 1 + all.length) % all.length]?.focus();
        break;
      case "Home":
        all[0]?.focus();
        break;
      case "End":
        all[all.length - 1]?.focus();
        break;
      case "Enter":
      case " ":
        all[i]?.click();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <ul className="context-menu" role="menu" aria-label={label} style={{ left: x, top: y }} ref={listRef} onKeyDown={onKeyDown}>
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {item.separatorBefore && i > 0 && <li className="sep" role="separator" />}
          <li
            role={item.checked === undefined ? "menuitem" : "menuitemradio"}
            aria-checked={item.checked}
            aria-disabled={item.disabled}
            tabIndex={-1}
            className={[item.disabled && "disabled", item.danger && "danger"].filter(Boolean).join(" ")}
            onClick={() => !item.disabled && item.onSelect()}
          >
            {item.checked !== undefined && <span className="menu-check">{item.checked ? "✓" : ""}</span>}
            {withIcons && <span className="menu-icon">{item.icon}</span>}
            <span className="menu-label">{item.label}</span>
            {item.hint && <span className="menu-hint">{item.hint}</span>}
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useExclusivePopup } from "./useExclusivePopup";
import { useFitInWindow } from "./useFitInWindow";

export interface ContextMenuItem {
  label: string;
  /** Not needed by an item with a submenu: picking it opens the submenu. */
  onSelect?: () => void;
  /** Opens beside this item on hover, click or the right arrow. */
  items?: ContextMenuItem[];
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
  /** Where a submenu ends when it opens leftwards for lack of room on the right. */
  flipX?: number;
  /** Left arrow in a submenu: back to the parent item. */
  onBack?: () => void;
}

interface OpenSubmenu {
  index: number;
  x: number;
  y: number;
  flipX: number;
}

/**
 * Floating menu at the pointer; any click elsewhere, Escape or leaving the window closes it.
 * It takes the focus, so the arrow keys move through the items and Enter picks one.
 */
export function ContextMenu({ x, y, items, onClose, label, flipX, onBack }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const [submenu, setSubmenu] = useState<OpenSubmenu | null>(null);

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

  // A submenu (it has `onBack`) belongs to its menu: it must not close it.
  useExclusivePopup(onClose, !onBack);
  useFitInWindow(listRef, x, y, flipX);
  // One item with an icon keeps a column for icons, so every label lines up.
  const withIcons = items.some((item) => item.icon);

  const enabledItems = () => [...(listRef.current?.querySelectorAll<HTMLLIElement>('li[role^="menuitem"]:not(.disabled)') ?? [])];

  useEffect(() => {
    const all = enabledItems();
    (all.find((li) => li.getAttribute("aria-checked") === "true") ?? all[0])?.focus();
  }, []);

  const openSubmenu = (index: number, li: HTMLLIElement) => {
    const rect = li.getBoundingClientRect();
    setSubmenu({ index, x: rect.right, y: rect.top, flipX: rect.left });
  };

  const closeSubmenu = () => {
    const index = submenu?.index;
    setSubmenu(null);
    listRef.current?.querySelector<HTMLLIElement>(`li[data-index="${index}"]`)?.focus();
  };

  const onItemClick = (item: ContextMenuItem, index: number, e: MouseEvent<HTMLLIElement>) => {
    if (item.disabled) return;
    if (item.items) {
      // Opening a submenu must not reach the window, which would close the whole menu.
      e.stopPropagation();
      return openSubmenu(index, e.currentTarget);
    }
    item.onSelect?.();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const all = enabledItems();
    const i = all.indexOf(document.activeElement as HTMLLIElement);
    switch (e.key) {
      case "ArrowRight": {
        const li = all[i];
        const index = Number(li?.dataset.index);
        if (!li || !items[index]?.items) return;
        openSubmenu(index, li);
        break;
      }
      case "ArrowLeft":
        if (!onBack) return;
        onBack();
        break;
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
        if (submenu) return;
        all[i]?.click();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const open = submenu && items[submenu.index]?.items;

  return (
    <>
      <ul className="context-menu" role="menu" aria-label={label} style={{ left: x, top: y }} ref={listRef} onKeyDown={onKeyDown}>
        {items.map((item, i) => (
          <Fragment key={item.label}>
            {item.separatorBefore && i > 0 && <li className="sep" role="separator" />}
            <li
              role={item.checked === undefined ? "menuitem" : "menuitemradio"}
              aria-checked={item.checked}
              aria-disabled={item.disabled}
              aria-haspopup={item.items ? "menu" : undefined}
              aria-expanded={item.items ? submenu?.index === i : undefined}
              data-index={i}
              tabIndex={-1}
              className={[item.disabled && "disabled", item.danger && "danger", submenu?.index === i && "open"].filter(Boolean).join(" ")}
              onClick={(e) => onItemClick(item, i, e)}
              onMouseEnter={(e) => {
                if (item.disabled || submenu?.index === i) return;
                if (item.items) openSubmenu(i, e.currentTarget);
                else setSubmenu(null);
              }}
            >
              {item.checked !== undefined && <span className="menu-check">{item.checked ? "✓" : ""}</span>}
              {withIcons && <span className="menu-icon">{item.icon}</span>}
              <span className="menu-label">{item.label}</span>
              {item.hint && <span className="menu-hint">{item.hint}</span>}
              {item.items && <span className="menu-arrow" aria-hidden>›</span>}
            </li>
          </Fragment>
        ))}
      </ul>
      {open && submenu && (
        <ContextMenu
          x={submenu.x}
          y={submenu.y}
          flipX={submenu.flipX}
          items={open}
          label={items[submenu.index].label}
          onClose={onClose}
          onBack={closeSubmenu}
        />
      )}
    </>
  );
}

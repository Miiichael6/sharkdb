import { useEffect } from "react";

export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface Props {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** Floating menu at the pointer; any click elsewhere, Escape or leaving the window closes it. */
export function ContextMenu({ x, y, items, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("click", onClose);
    window.addEventListener("blur", onClose);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClose);
      window.removeEventListener("blur", onClose);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <ul className="context-menu" role="menu" style={{ left: x, top: y }}>
      {items.map((item) => (
        <li
          key={item.label}
          role="menuitem"
          aria-disabled={item.disabled}
          className={item.disabled ? "disabled" : ""}
          onClick={() => !item.disabled && item.onSelect()}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}
